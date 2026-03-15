package com.p10racing.app;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Enable edge-to-edge display for Android 15 (SDK 35+) support.
        // On Android 15+, the system ignores specific bar style parameters to enforce transparency.
        // We use the simpler enable(this) which avoids deprecated API calls on SDK 35.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
        
        // Ensure any residual native ActionBar is killed
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }
    }
}
