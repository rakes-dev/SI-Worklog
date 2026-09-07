package com.si_worklog.com;

import android.content.Intent;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

/**
 * Local Capacitor Plugin: Triggers Android Play Services Google Sign-In dialog.
 * Opens the native system account picker listing Google accounts saved on the phone.
 */
@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {
    private static final String TAG = "NativeGoogleAuth";

    @PluginMethod
    public void signIn(PluginCall call) {
        String webClientId = call.getString("webClientId");

        GoogleSignInOptions.Builder gsoBuilder = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestProfile();

        if (webClientId != null && !webClientId.trim().isEmpty()) {
            gsoBuilder.requestIdToken(webClientId.trim());
        }

        GoogleSignInOptions gso = gsoBuilder.build();
        GoogleSignInClient client = GoogleSignIn.getClient(getActivity(), gso);

        // Sign out first to ensure the native account picker bottom sheet opens
        client.signOut().addOnCompleteListener(getActivity(), task -> {
            Intent signInIntent = client.getSignInIntent();
            startActivityForResult(call, signInIntent, "handleGoogleSignInResult");
        });
    }

    @ActivityCallback
    private void handleGoogleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        Intent data = result.getData();
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);

        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            if (account != null) {
                JSObject ret = new JSObject();
                ret.put("idToken", account.getIdToken());
                ret.put("serverAuthCode", account.getServerAuthCode());
                ret.put("email", account.getEmail());
                ret.put("displayName", account.getDisplayName());
                ret.put("id", account.getId());
                ret.put("photoUrl", account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : null);
                call.resolve(ret);
            } else {
                call.reject("Google sign in failed: Account is null");
            }
        } catch (ApiException e) {
            Log.e(TAG, "Google sign in failed code=" + e.getStatusCode(), e);
            if (e.getStatusCode() == 12501) {
                call.reject("Google sign in canceled by user");
            } else {
                call.reject("Google sign in failed (code " + e.getStatusCode() + "): " + e.getLocalizedMessage());
            }
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).build();
        GoogleSignInClient client = GoogleSignIn.getClient(getActivity(), gso);
        client.signOut().addOnCompleteListener(getActivity(), task -> call.resolve());
    }
}
