#!/bin/bash

echo "🚀 Starting Sara Stories Build Process..."

# Set Java Home explicitly
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

echo "✓ Java version:"
java -version

echo "📱 Syncing Capacitor..."
cd /home/scarface/Desktop/sara-front-end
npx cap sync android

echo "🧹 Cleaning everything..."
cd android
rm -rf .gradle
rm -rf build
rm -rf app/build

echo "🔄 Running clean build..."
./gradlew clean

echo "🔧 Building debug version..."
./gradlew assembleDebug --no-daemon

if [ $? -eq 0 ]; then
    echo "✅ Debug build successful!"
    
    echo "🚀 Building release version..."
    ./gradlew assembleRelease --no-daemon
    
    if [ $? -eq 0 ]; then
        echo "🎉 SUCCESS! Release APK generated!"
        echo "📁 APK Location: app/build/outputs/apk/release/app-release.apk"
        echo "📁 AAB Location: app/build/outputs/bundle/release/app-release.aab"
        
        # Verify the APK
        echo "🔍 Verifying APK..."
        if command -v aapt2 &> /dev/null; then
            aapt2 dump badging app/build/outputs/apk/release/app-release.apk | grep "package"
        else
            echo "ℹ️ aapt2 not found, skipping APK verification"
        fi
    else
        echo "❌ Release build failed!"
        echo "Trying with more details..."
        ./gradlew assembleRelease --stacktrace
        exit 1
    fi
else
    echo "❌ Debug build failed!"
    echo "Trying with more details..."
    ./gradlew assembleDebug --stacktrace
    exit 1
fi