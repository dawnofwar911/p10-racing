package com.p10racing.app;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Enable edge-to-edge display for Android 15 (SDK 35+) support
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
        
        // Ensure the ActionBar is hidden even if the theme fails to suppress it
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }
        
        // Ensure the content can be drawn under the system bars
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
