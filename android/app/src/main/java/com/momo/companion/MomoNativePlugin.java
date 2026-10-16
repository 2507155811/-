package com.momo.companion;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name="MomoNative", permissions={
    @Permission(alias="notifications", strings={Manifest.permission.POST_NOTIFICATIONS})
})
public class MomoNativePlugin extends Plugin {
    private static final String MODEL="qwen2.5-0.5b-instruct-q4_k_m.gguf";
    private static final String SHA256="74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db";
    private static final long MODEL_BYTES=491400032L;
    static { System.loadLibrary("momo_ai"); }
    private static native void nativeBegin();
    private static native void nativeLoad(String path);
    private static native byte[] nativeComplete(byte[] prompt,int threads,int maxTokens);
    private static native void nativeUnload();
    private static native void nativeCancel();
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy=new AtomicBoolean(false);
    private final Handler handler=new Handler(Looper.getMainLooper());
    private volatile boolean loaded=false, requestCancelled=false, destroyed=false;
    private PowerManager.OnThermalStatusChangedListener thermalListener;
    private final Runnable unload=()->{
        if(!worker.isShutdown()) worker.execute(()->{nativeUnload();loaded=false;});
    };

    @Override public void load(){
        if(Build.VERSION.SDK_INT>=29){
            thermalListener=status->{if(status>=PowerManager.THERMAL_STATUS_MODERATE)cancelRequest();};
            getContext().getSystemService(PowerManager.class).addThermalStatusListener(thermalListener);
        }
    }
    private File model(){return new File(getContext().getFilesDir(),MODEL);}
    private File marker(){return new File(getContext().getFilesDir(),MODEL+".sha256");}
    private boolean installed(){
        if(model().length()!=MODEL_BYTES)return false;
        try(FileInputStream in=new FileInputStream(marker())){
            byte[] digest=new byte[64];return in.read(digest)==64&&SHA256.equals(new String(digest,StandardCharsets.US_ASCII));
        }catch(IOException error){return false;}
    }
    private boolean bundled(){
        try {String[] assets=getContext().getAssets().list("ai");return assets!=null&&Arrays.asList(assets).contains(MODEL);}
        catch(IOException error){return false;}
    }
    private void cancelRequest(){requestCancelled=true;nativeCancel();}

    // The APK contains the weight. Copy it once to private storage for memory mapping;
    // do not hash 469 MiB on every chat, and never perform this work on the UI thread.
    private void ensureBundledModel() throws Exception {
        if(installed())return;
        File partial=new File(getContext().getFilesDir(),"model.partial");
        try {
            MessageDigest hash=MessageDigest.getInstance("SHA-256");
            try(InputStream in=getContext().getAssets().open("ai/"+MODEL);
                FileOutputStream out=new FileOutputStream(partial)){
                byte[] buffer=new byte[1024*1024];int count;
                while((count=in.read(buffer))!=-1){
                    if(requestCancelled)throw new IOException("Preparation cancelled");
                    out.write(buffer,0,count);hash.update(buffer,0,count);
                }
            }
            StringBuilder hex=new StringBuilder();
            for(byte value:hash.digest())hex.append(String.format("%02x",value));
            if(!SHA256.equals(hex.toString())||partial.length()!=MODEL_BYTES)throw new IOException("Model checksum mismatch");
            if(requestCancelled)throw new IOException("Preparation cancelled");
            if(!partial.renameTo(model()))throw new IOException("Cannot store model");
            try(FileOutputStream out=new FileOutputStream(marker())){out.write(SHA256.getBytes(StandardCharsets.US_ASCII));}
        } finally {if(partial.exists())partial.delete();}
    }

    @PluginMethod public void status(PluginCall call){
        JSObject result=new JSObject();result.put("runtimeAvailable",true);
        result.put("modelAvailable",installed());result.put("bundledModelAvailable",bundled());
        result.put("loaded",loaded);result.put("busy",busy.get());
        result.put("overlayAllowed",Settings.canDrawOverlays(getContext()));
        result.put("threads",2);result.put("context",2048);result.put("maxTokens",128);call.resolve(result);
    }
    @PluginMethod public void requestOverlayPermission(PluginCall call){
        getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getContext().getPackageName())));call.resolve();
    }
    @PluginMethod public void showOverlay(PluginCall call){
        if(!Settings.canDrawOverlays(getContext())){call.reject("请先允许显示在其他应用上层");return;}
        getContext().startForegroundService(new Intent(getContext(),PetOverlayService.class));call.resolve();
    }
    @PluginMethod public void hideOverlay(PluginCall call){
        getContext().stopService(new Intent(getContext(),PetOverlayService.class));call.resolve();
    }
    @PluginMethod public void loadBundledModel(PluginCall call){
        if(!busy.compareAndSet(false,true)){call.reject("正在准备或推理，请先停止");return;}
        requestCancelled=false;
        worker.execute(()->{
            try{ensureBundledModel();call.resolve();}
            catch(Exception error){call.reject("模型准备失败或已停止："+error.getMessage(),error);}
            finally{busy.set(false);}
        });
    }
    @PluginMethod public void chat(PluginCall call){
        PowerManager power=getContext().getSystemService(PowerManager.class);
        if(Build.VERSION.SDK_INT>=29&&power.getCurrentThermalStatus()>=PowerManager.THERMAL_STATUS_MODERATE){call.reject("设备温度较高，请稍后再使用 AI");return;}
        final int threads=power.isPowerSaveMode()?1:2,maxTokens=power.isPowerSaveMode()?64:128;
        final String prompt=call.getString("prompt","");
        if(prompt.length()>16000){call.reject("消息过长");return;}
        if(!busy.compareAndSet(false,true)){call.reject("正在回复，请稍候");return;}
        handler.removeCallbacks(unload);requestCancelled=false;nativeBegin();
        worker.execute(()->{
            try{
                ensureBundledModel();
                if(requestCancelled)throw new IOException("Inference cancelled");
                if(!loaded){nativeLoad(model().getAbsolutePath());loaded=true;}
                byte[] response=nativeComplete(prompt.getBytes(StandardCharsets.UTF_8),threads,maxTokens);
                JSObject result=new JSObject();result.put("text",new String(response,StandardCharsets.UTF_8));call.resolve(result);
            }catch(Exception error){call.reject("准备或推理失败/已停止："+error.getMessage(),error);}
            finally{busy.set(false);if(!destroyed)handler.postDelayed(unload,30000);}
        });
    }
    @PluginMethod public void cancel(PluginCall call){cancelRequest();call.resolve();}
    @PluginMethod public void unload(PluginCall call){
        cancelRequest();handler.removeCallbacks(unload);
        worker.execute(()->{nativeUnload();loaded=false;call.resolve();});
    }
    @Override protected void handleOnPause(){cancelRequest();handler.postDelayed(unload,30000);}
    @Override protected void handleOnDestroy(){
        destroyed=true;cancelRequest();handler.removeCallbacks(unload);
        if(Build.VERSION.SDK_INT>=29&&thermalListener!=null)getContext().getSystemService(PowerManager.class).removeThermalStatusListener(thermalListener);
        worker.execute(()->{nativeUnload();loaded=false;});worker.shutdown();
    }
}
