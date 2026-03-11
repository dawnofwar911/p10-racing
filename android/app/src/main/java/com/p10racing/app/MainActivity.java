package com.p10racing.app;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Enable edge-to-edge display for Android 15 (SDK 35+) support
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
