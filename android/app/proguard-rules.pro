# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# --- P10 Racing: R8 rules (Capacitor plugins ship their own consumer rules) ---
# Keep line numbers so Play Console stack traces deobfuscate with the uploaded mapping.
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile
# WebView JS bridge methods are called by name from JavaScript.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.getcapacitor.Bridge { *; }
-keep class com.getcapacitor.MessageHandler { *; }

# --- Crash-on-launch fix after enabling R8: keep the native bridge layer intact ---
# Capacitor/Cordova resolve plugins, bridge calls and config by class/method name at runtime.
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep class org.apache.cordova.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class * extends org.apache.cordova.CordovaPlugin { *; }
-dontwarn com.getcapacitor.**
-dontwarn org.apache.cordova.**
