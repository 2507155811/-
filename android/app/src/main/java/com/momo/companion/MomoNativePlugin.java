package com.momo.companion;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Build;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import android.Manifest;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name="MomoNative",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class MomoNativePlugin extends Plugin {
    static { System.loadLibrary("momo_ai"); }
    private static native void nativeBegin();
    private static native void nativeLoad(String path);
    private static native byte[] nativeComplete(byte[] prompt,int threads,int maxTokens);
    private static native void nativeUnload();
    private static native void nativeCancel();
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy=new AtomicBoolean(false);
    private final Handler handler=new Handler(Looper.getMainLooper());
    private volatile boolean loaded=false;
    private PowerManager.OnThermalStatusChangedListener thermalListener;
    @Override public void load(){if(Build.VERSION.SDK_INT>=29){thermalListener=status->{if(status>=PowerManager.THERMAL_STATUS_MODERATE)nativeCancel();};getContext().getSystemService(PowerManager.class).addThermalStatusListener(thermalListener);}}
    private final Runnable unload=()->worker.execute(()->{nativeUnload();loaded=false;});
    private File model(){return new File(getContext().getFilesDir(),"qwen2.5-0.5b-instruct-q4_k_m.gguf");}
    @PluginMethod public void status(PluginCall call){JSObject result=new JSObject();result.put("runtimeAvailable",true);result.put("modelAvailable",model().exists());result.put("loaded",loaded);result.put("busy",busy.get());result.put("overlayAllowed",Settings.canDrawOverlays(getContext()));result.put("threads",2);result.put("context",2048);result.put("maxTokens",128);call.resolve(result);}
    @PluginMethod public void requestOverlayPermission(PluginCall call){getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getContext().getPackageName())));call.resolve();}
    @PluginMethod public void showOverlay(PluginCall call){if(!Settings.canDrawOverlays(getContext())){call.reject("请先允许显示在其他应用上层");return;}Intent intent=new Intent(getContext(),PetOverlayService.class);getContext().startForegroundService(intent);call.resolve();}
    @PluginMethod public void hideOverlay(PluginCall call){getContext().stopService(new Intent(getContext(),PetOverlayService.class));call.resolve();}
    @PluginMethod public void loadBundledModel(PluginCall call){if(!busy.compareAndSet(false,true)){call.reject("正在推理，请先停止");return;}worker.execute(()->{nativeUnload();loaded=false;File partial=new File(getContext().getFilesDir(),"model.partial");try{java.security.MessageDigest hash=java.security.MessageDigest.getInstance("SHA-256");try(InputStream in=getContext().getAssets().open("ai/qwen2.5-0.5b-instruct-q4_k_m.gguf");FileOutputStream out=new FileOutputStream(partial)){byte[] buffer=new byte[1024*1024];int n;while((n=in.read(buffer))!=-1){out.write(buffer,0,n);hash.update(buffer,0,n);}}StringBuilder hex=new StringBuilder();for(byte b:hash.digest())hex.append(String.format("%02x",b));if(!hex.toString().equals("74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db"))throw new IOException("Checksum mismatch");try(FileInputStream in=new FileInputStream(partial)){byte[] magic=new byte[4];if(in.read(magic)!=4||!new String(magic,StandardCharsets.US_ASCII).equals("GGUF"))throw new IOException("Invalid GGUF");}if(!partial.renameTo(model()))throw new IOException("Cannot store model");call.resolve();}catch(Exception error){partial.delete();call.reject("安装包内没有可用权重，请先完成模型打包",error);}finally{busy.set(false);}});}
    @PluginMethod public void chat(PluginCall call){PowerManager power=getContext().getSystemService(PowerManager.class);if(Build.VERSION.SDK_INT>=29&&power.getCurrentThermalStatus()>=PowerManager.THERMAL_STATUS_MODERATE){call.reject("设备温度较高，请稍后再使用 AI");return;}int threads=power.isPowerSaveMode()?1:2;int maxTokens=power.isPowerSaveMode()?64:128;String prompt=call.getString("prompt","");if(prompt.length()>16000){call.reject("消息过长");return;}if(!model().exists()){call.reject("请先从安装包安装内置模型");return;}if(!busy.compareAndSet(false,true)){call.reject("正在回复，请稍候");return;}handler.removeCallbacks(unload);nativeBegin();worker.execute(()->{try{if(!loaded){nativeLoad(model().getAbsolutePath());loaded=true;}byte[] response=nativeComplete(prompt.getBytes(StandardCharsets.UTF_8),threads,maxTokens);JSObject result=new JSObject();result.put("text",new String(response,StandardCharsets.UTF_8));call.resolve(result);}catch(Exception error){call.reject("推理失败或已停止："+error.getMessage(),error);}finally{busy.set(false);handler.postDelayed(unload,30000);}});}
    @PluginMethod public void cancel(PluginCall call){nativeCancel();call.resolve();}
    @PluginMethod public void unload(PluginCall call){nativeCancel();handler.removeCallbacks(unload);worker.execute(()->{nativeUnload();loaded=false;call.resolve();});}
    @Override protected void handleOnPause(){nativeCancel();handler.postDelayed(unload,30000);}
    @Override protected void handleOnDestroy(){if(Build.VERSION.SDK_INT>=29&&thermalListener!=null)getContext().getSystemService(PowerManager.class).removeThermalStatusListener(thermalListener);nativeCancel();handler.removeCallbacks(unload);worker.execute(()->{nativeUnload();loaded=false;});worker.shutdown();}
}
