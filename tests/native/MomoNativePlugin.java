package com.momo.companion;
import java.nio.charset.StandardCharsets;
public class MomoNativePlugin {
 static {System.loadLibrary("momo_ai");}
 private static native void nativeBegin();
 private static native void nativeLoad(String path);
 private static native byte[] nativeComplete(byte[] prompt,int threads,int maxTokens);
 private static native void nativeUnload();
 private static native void nativeCancel();
 public static void main(String[] args)throws Exception{
  try{nativeBegin();nativeLoad(args[0]);String prompt="<|im_start|>system\n你是桌面宠物MOMO，用简短的中文回答。记忆：用户喜欢红茶。<|im_end|>\n<|im_start|>user\n我喜欢喝什么？<|im_end|>\n<|im_start|>assistant\n";
   String result=new String(nativeComplete(prompt.getBytes(StandardCharsets.UTF_8),2,64),StandardCharsets.UTF_8);System.out.println("Android JNI source, host JVM reply: "+result);if(!result.contains("红茶"))throw new AssertionError("Memory prompt failed");
   nativeCancel();boolean cancelled=false;try{nativeComplete(prompt.getBytes(StandardCharsets.UTF_8),1,64);}catch(IllegalStateException e){cancelled=true;}if(!cancelled)throw new AssertionError("Cancellation was ignored");
   nativeBegin();String again=new String(nativeComplete(prompt.getBytes(StandardCharsets.UTF_8),1,64),StandardCharsets.UTF_8);if(!again.contains("红茶"))throw new AssertionError("Low-power retry failed");System.out.println("PASS: exact JNI source inference, UTF-8, cancellation and 1-thread retry. Not an Android device test.");
  }finally{nativeUnload();}
 }
}
