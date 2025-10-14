package com.littlestories.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int REQUEST_MICROPHONE_PERMISSION = 200;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        askForPermissions();
        configureWebView();
    }

    private void askForPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_MICROPHONE_PERMISSION);
            }
        }
    }

    private void configureWebView() {
        WebView webView = new WebView(this);
        WebSettings webSettings = webView.getSettings();
        webSettings.setMediaPlaybackRequiresUserGesture(false); // Allow auto playback of media (like audio)
    }
}
