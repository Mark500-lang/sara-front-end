# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ========== CAPACITOR SPECIFIC RULES ==========
# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }
-keep class androidx.activity.** { *; }
-keep class androidx.fragment.** { *; }
-keep class androidx.webkit.** { *; }

# Keep Capacitor plugins
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class * extends com.getcapacitor.BridgeActivity { *; }

# Keep JavaScript interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ========== REACT/CAPACITOR WEBVIEW RULES ==========
# Keep WebView functionality
-keep class org.apache.cordova.** { *; }
-keep class com.getcapacitor.cordova.** { *; }

# Keep JavaScript bridge
-keepclassmembers class * {
    public void sendJavascript(java.lang.String);
}

# ========== GOOGLE SERVICES & FIREBASE ==========
# Keep Firebase classes if using
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# ========== REVENUECAT ==========
# Keep RevenueCat classes
-keep class com.revenuecat.purchases.** { *; }

# ========== REFLECTION & ANNOTATIONS ==========
# Keep annotations for dependency injection frameworks
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses

# Keep generic types for proper Gson/Jackson parsing
-keepattributes Signature
-keepattributes EnclosingMethod

# ========== NETWORKING ==========
# Keep OkHttp/Retrofit classes
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-keep class retrofit2.** { *; }

# ========== MISC ==========
# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
-renamesourcefileattribute SourceFile

# ========== SECURE STORAGE PLUGIN ==========
# Keep secure storage plugin classes
-keep class com.aparajita.capacitor.securesstorage.** { *; }

# ========== VOICE RECORDER PLUGIN ==========
# Keep voice recorder plugin classes
-keep class com.recorder.capacitor.** { *; }

# ========== RESOURCES ==========
# Keep resources for Capacitor
-keepclassmembers class **.R$* {
    public static <fields>;
}