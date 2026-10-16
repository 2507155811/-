package com.momo.companion;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle state){registerPlugin(MomoNativePlugin.class);super.onCreate(state);}
 @Override public void onPause(){if(getBridge()!=null)getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new CustomEvent('momo-power',{detail:{paused:true}}))",null);super.onPause();}
 @Override public void onResume(){super.onResume();if(getBridge()!=null)getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new CustomEvent('momo-power',{detail:{paused:false}}))",null);}
}

