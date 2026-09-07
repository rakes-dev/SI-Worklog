package com.si_worklog.com;

import android.app.Dialog;
import android.os.Bundle;
import android.os.Message;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register local plugins before super.onCreate
        registerPlugin(NativePrintPlugin.class);
        registerPlugin(NativeGoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);

        setupWebViewForGoogleAuth();
    }

    private void setupWebViewForGoogleAuth() {
        if (this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }

        WebView mainWebView = this.bridge.getWebView();
        WebSettings mainSettings = mainWebView.getSettings();

        // 1. Remove '; wv' from User-Agent to prevent Google OAuth 'disallowed_useragent' error
        String originalUA = mainSettings.getUserAgentString();
        if (originalUA != null) {
            String cleanUA = originalUA.replace("; wv", "").replace("; wv)", ")");
            mainSettings.setUserAgentString(cleanUA);
        }

        // 2. Enable support for popup windows (window.open) required by signInWithPopup
        mainSettings.setJavaScriptCanOpenWindowsAutomatically(true);
        mainSettings.setSupportMultipleWindows(true);

        // 3. Use CustomBridgeWebChromeClient to preserve Capacitor's native bridge features while enabling popup dialogs
        mainWebView.setWebChromeClient(new CustomBridgeWebChromeClient(this.bridge, this));
    }

    private static class CustomBridgeWebChromeClient extends BridgeWebChromeClient {
        private final MainActivity activity;

        CustomBridgeWebChromeClient(Bridge bridge, MainActivity activity) {
            super(bridge);
            this.activity = activity;
        }

        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
            WebView popupWebView = new WebView(activity);
            WebSettings popupSettings = popupWebView.getSettings();

            popupSettings.setJavaScriptEnabled(true);
            popupSettings.setDomStorageEnabled(true);
            popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);

            String popupUA = popupSettings.getUserAgentString();
            if (popupUA != null) {
                popupSettings.setUserAgentString(popupUA.replace("; wv", "").replace("; wv)", ")"));
            }

            Dialog dialog = new Dialog(activity, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
            dialog.setContentView(popupWebView);
            if (dialog.getWindow() != null) {
                dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            }
            dialog.show();

            popupWebView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onCloseWindow(WebView window) {
                    if (dialog.isShowing()) {
                        dialog.dismiss();
                    }
                }
            });

            popupWebView.setWebViewClient(new WebViewClient());

            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(popupWebView);
            resultMsg.sendToTarget();
            return true;
        }
    }
}
