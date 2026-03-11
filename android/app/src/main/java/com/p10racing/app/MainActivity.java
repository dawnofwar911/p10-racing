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
        // We use SystemBarStyle.dark(Color.TRANSPARENT) to ensure the status bar
        // is transparent and icons are light (white), matching our dark theme.
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
        super.onCreate(savedInstanceState);
        
        // Ensure the ActionBar is hidden even if the theme fails to suppress it
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }
    }
}
