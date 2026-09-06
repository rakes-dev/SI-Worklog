package com.si_worklog.com;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Local plugin: system print dialog for generated PDFs.
        registerPlugin(NativePrintPlugin.class);
    }
}

