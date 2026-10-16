package com.momo.companion;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.net.URLConnection;
import java.util.Map;

public class PetOverlayService extends Service {
    private static volatile PetOverlayService activeService;
    private static volatile boolean aiActive=false;
    public static void setAIActive(boolean active){
        aiActive=active;PetOverlayService service=activeService;
        if(service!=null)new Handler(Looper.getMainLooper()).post(()->{
            if(activeService==service&&service.web!=null)service.web.evaluateJavascript("window.dispatchEvent(new CustomEvent('momo-ai-busy',{detail:"+active+"}))",null);
        });
    }
    private WindowManager manager;private FrameLayout root;private WebView web;private WindowManager.LayoutParams params;
    private final BroadcastReceiver screenReceiver=new BroadcastReceiver(){@Override public void onReceive(Context context,Intent intent){if(web==null)return;if(Intent.ACTION_SCREEN_OFF.equals(intent.getAction())){web.evaluateJavascript("window.dispatchEvent(new CustomEvent('momo-power',{detail:{paused:true}}))",null);web.onPause();}else{web.onResume();web.evaluateJavascript("window.dispatchEvent(new CustomEvent('momo-power',{detail:{paused:false}}))",null);}}};
    @Override public void onCreate(){super.onCreate();activeService=this;NotificationManager notifications=getSystemService(NotificationManager.class);notifications.createNotificationChannel(new NotificationChannel("momo-pet","桌面陪伴",NotificationManager.IMPORTANCE_LOW));IntentFilter filter=new IntentFilter();filter.addAction(Intent.ACTION_SCREEN_OFF);filter.addAction(Intent.ACTION_SCREEN_ON);if(Build.VERSION.SDK_INT>=33)registerReceiver(screenReceiver,filter,Context.RECEIVER_NOT_EXPORTED);else registerReceiver(screenReceiver,filter);}
    public static final String ACTION_SHOW="momo.SHOW", ACTION_HIDE="momo.HIDE", ACTION_KEEP_ALIVE="momo.KEEP_ALIVE", ACTION_STOP="momo.STOP";
    public static volatile boolean running=false;
    public static boolean keepAliveEnabled(Context context){return context.getSharedPreferences("momo-native",MODE_PRIVATE).getBoolean("keepAlive",false);}
    @Override public int onStartCommand(Intent intent,int flags,int id){
        String action=intent==null?ACTION_KEEP_ALIVE:intent.getAction();
        if(ACTION_STOP.equals(action)||"stop".equals(action)){
            getSharedPreferences("momo-native",MODE_PRIVATE).edit().putBoolean("keepAlive",false).apply();stopSelf();return START_NOT_STICKY;
        }
        boolean keepAlive=keepAliveEnabled(this);
        if(ACTION_HIDE.equals(action))removePet();
        if(!keepAlive&&root==null&&!ACTION_SHOW.equals(action)){stopSelf();return START_NOT_STICKY;}
        running=true;
        // Foreground notification is posted before any WebView/3D initialization.
        updateNotification(keepAlive);
        if(ACTION_SHOW.equals(action)&&root==null&&android.provider.Settings.canDrawOverlays(this))showPet();
        if(!keepAlive&&root==null){stopSelf();return START_NOT_STICKY;}
        updateNotification(keepAlive);
        return keepAlive?START_STICKY:START_NOT_STICKY;
    }
    private void updateNotification(boolean keepAlive){
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,PetOverlayService.class).setAction(ACTION_STOP),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder builder=new Notification.Builder(this,"momo-pet").setContentTitle("MOMO 正在陪伴你")
            .setContentText(root!=null?"桌面宠物已显示；息屏暂停动画": "轻量后台陪伴；点击回到宠物，AI 空闲后卸载")
            .setSmallIcon(R.drawable.ic_momo_notification).setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true);
        if(root!=null){PendingIntent hide=PendingIntent.getService(this,2,new Intent(this,PetOverlayService.class).setAction(ACTION_HIDE),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);builder.addAction(new Notification.Action.Builder(null,"收起宠物",hide).build());}
        builder.addAction(new Notification.Action.Builder(null,keepAlive?"停止后台陪伴":"停止陪伴",stop).build());
        startForeground(71,builder.build());
    }
    private void removePet(){
        if(root!=null){manager.removeView(root);web.stopLoading();web.loadUrl("about:blank");web.destroy();root=null;web=null;}
    }
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    @SuppressWarnings("SetJavaScriptEnabled") private void showPet(){manager=getSystemService(WindowManager.class);params=new WindowManager.LayoutParams(dp(240),dp(300),WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,android.graphics.PixelFormat.TRANSLUCENT);params.gravity=Gravity.TOP|Gravity.START;params.x=dp(30);params.y=dp(130);root=new FrameLayout(this);web=new WebView(this);web.setBackgroundColor(Color.TRANSPARENT);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setMediaPlaybackRequiresUserGesture(true);web.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView view,String url){view.evaluateJavascript("window.dispatchEvent(new CustomEvent('momo-ai-busy',{detail:"+aiActive+"}))",null);}@Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){if(!"localhost".equals(request.getUrl().getHost()))return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));String path=request.getUrl().getPath();if(path==null||path.equals("/"))path="/index.html";if(path.contains(".."))return null;try{String mime=URLConnection.guessContentTypeFromName(path);if(path.endsWith(".js"))mime="application/javascript";if(path.endsWith(".css"))mime="text/css";return new WebResourceResponse(mime==null?"application/octet-stream":mime,"UTF-8",getAssets().open("public"+path));}catch(IOException error){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}}@Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !"localhost".equals(request.getUrl().getHost());}});FrameLayout.LayoutParams webParams=new FrameLayout.LayoutParams(-1,-1);webParams.topMargin=dp(26);root.addView(web,webParams);TextView handle=new TextView(this);handle.setText("✳ MOMO    拖动移动");handle.setTextColor(0xff8e76a8);handle.setBackgroundColor(0xccffffff);handle.setTextSize(11);handle.setGravity(Gravity.CENTER);root.addView(handle,new FrameLayout.LayoutParams(-1,dp(26)));handle.setOnTouchListener(new View.OnTouchListener(){float downX,downY;int startX,startY;@Override public boolean onTouch(View view,android.view.MotionEvent event){if(event.getAction()==MotionEvent.ACTION_DOWN){downX=event.getRawX();downY=event.getRawY();startX=params.x;startY=params.y;return true;}if(event.getAction()==MotionEvent.ACTION_MOVE){int width=getResources().getDisplayMetrics().widthPixels,height=getResources().getDisplayMetrics().heightPixels;params.x=Math.max(0,Math.min(width-params.width,startX+(int)(event.getRawX()-downX)));params.y=Math.max(0,Math.min(height-params.height,startY+(int)(event.getRawY()-downY)));manager.updateViewLayout(root,params);return true;}return true;}});manager.addView(root,params);web.loadUrl("https://localhost/?pet=1");}
    @Override public void onDestroy(){if(activeService==this)activeService=null;unregisterReceiver(screenReceiver);running=false;removePet();super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
