package com.sniperbo.app;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LiveHouse")
public class LiveHousePlugin extends Plugin {
    private WebView liveWebView;
    private ViewGroup liveParent;
    private String currentUrl = "";

    @Override
    protected void handleOnPause() {
        if (liveWebView == null) return;
        getActivity().runOnUiThread(() -> {
            if (liveWebView == null) return;
            liveWebView.onPause();
            CookieManager.getInstance().flush();
        });
    }

    @Override
    protected void handleOnResume() {
        if (liveWebView == null) return;
        getActivity().runOnUiThread(() -> {
            if (liveWebView != null && liveWebView.getVisibility() == View.VISIBLE) {
                liveWebView.onResume();
            }
        });
    }

    @PluginMethod
    public void show(PluginCall call) {
        final String url = call.getString("url", "");
        if (!isAllowedUrl(url)) {
            call.reject("URL da plataforma nao permitida.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            ensureWebView();
            applyBounds(call);
            liveWebView.onResume();
            liveWebView.setVisibility(View.VISIBLE);
            liveWebView.bringToFront();
            if (!url.equals(currentUrl)) {
                currentUrl = url;
                liveWebView.loadUrl(url);
            }
            call.resolve(status());
        });
    }

    @PluginMethod
    public void updateBounds(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (liveWebView != null) applyBounds(call);
            call.resolve(status());
        });
    }

    @PluginMethod
    public void reload(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (liveWebView != null) liveWebView.reload();
            call.resolve(status());
        });
    }

    @PluginMethod
    public void hide(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (liveWebView != null) {
                liveWebView.onPause();
                liveWebView.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
            }
            call.resolve(status());
        });
    }

    @PluginMethod
    public void destroy(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (liveWebView != null) {
                liveWebView.stopLoading();
                liveWebView.onPause();
                liveWebView.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
                if (liveParent != null) liveParent.removeView(liveWebView);
                liveWebView.destroy();
                liveWebView = null;
                liveParent = null;
                currentUrl = "";
            }
            call.resolve(status());
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void ensureWebView() {
        if (liveWebView != null) return;

        View mainWebView = getBridge().getWebView();
        if (!(mainWebView.getParent() instanceof ViewGroup)) {
            throw new IllegalStateException("Container principal da Sniper BO indisponivel.");
        }
        liveParent = (ViewGroup) mainWebView.getParent();
        liveWebView = new WebView(getContext());
        liveWebView.setBackgroundColor(Color.rgb(2, 7, 18));

        WebSettings settings = liveWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(liveWebView, true);

        liveWebView.setWebChromeClient(new WebChromeClient());
        liveWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                CookieManager.getInstance().flush();
                JSObject event = new JSObject();
                event.put("url", url == null ? "" : url);
                event.put("requestedUrl", currentUrl);
                notifyListeners("pageFinished", event);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    return false;
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    getActivity().startActivity(intent);
                } catch (Exception ignored) {
                    // Keep the platform open when an optional external app is unavailable.
                }
                return true;
            }
        });

        liveParent.addView(liveWebView, new FrameLayout.LayoutParams(1, 1));
    }

    private void applyBounds(PluginCall call) {
        if (liveWebView == null) return;
        float density = getContext().getResources().getDisplayMetrics().density;
        int left = Math.max(0, Math.round(call.getFloat("left", 0f) * density));
        int top = Math.max(0, Math.round(call.getFloat("top", 0f) * density));
        int width = Math.max(1, Math.round(call.getFloat("width", 1f) * density));
        int height = Math.max(1, Math.round(call.getFloat("height", 1f) * density));

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(width, height);
        params.leftMargin = left;
        params.topMargin = top;
        liveWebView.setLayoutParams(params);
    }

    private boolean isAllowedUrl(String url) {
        if (url == null || url.isEmpty()) return false;
        try {
            Uri uri = Uri.parse(url);
            String host = uri.getHost();
            return "https".equalsIgnoreCase(uri.getScheme()) && host != null &&
                (host.equals("go.aff.esportiva.bet") || host.endsWith(".esportiva.bet") || host.equals("esportiva.bet"));
        } catch (Exception ignored) {
            return false;
        }
    }

    private JSObject status() {
        JSObject result = new JSObject();
        result.put("active", liveWebView != null && liveWebView.getVisibility() == View.VISIBLE);
        result.put("url", currentUrl);
        return result;
    }
}
