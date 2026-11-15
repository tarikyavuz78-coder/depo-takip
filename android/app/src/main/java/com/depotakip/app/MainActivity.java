package com.depotakip.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanOptions;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends AppCompatActivity {

    private static final String PREFS = "depotakip";
    private static final String KEY_SERVER = "server_url";
    private static final String CHANNEL_ID = "stok_uyarilari";
    private static final int BRAND = Color.parseColor("#0F4C52");

    private SharedPreferences prefs;
    private FrameLayout root;
    private WebView webView;
    private String serverUrl;
    private boolean scanForSetup = false;
    private EditText setupInput;
    private TextView setupStatus;
    private ValueCallback<Uri[]> fileCallback;
    private int notifId = 1000;

    private final ActivityResultLauncher<ScanOptions> zxingLauncher =
            registerForActivityResult(new ScanContract(), result -> {
                if (result.getContents() == null) onScanCancelled();
                else onScanResult(result.getContents());
            });

    private final ActivityResultLauncher<Intent> fileLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (fileCallback == null) return;
                Uri[] uris = null;
                if (result.getResultCode() == RESULT_OK && result.getData() != null && result.getData().getData() != null) {
                    uris = new Uri[]{result.getData().getData()};
                }
                fileCallback.onReceiveValue(uris);
                fileCallback = null;
            });

    private final ActivityResultLauncher<String> permLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> { });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#EEF1F0"));
        setContentView(root);
        createChannel();
        if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            permLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
        }
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.getParent() != null) {
                    webView.evaluateJavascript("(window.__onNativeBack && window.__onNativeBack()) ? 'yes' : 'no'", value -> {
                        if (value == null || !value.contains("yes")) {
                            if (webView.canGoBack()) webView.goBack();
                            else moveTaskToBack(true);
                        }
                    });
                } else {
                    finish();
                }
            }
        });
        serverUrl = prefs.getString(KEY_SERVER, null);
        if (serverUrl == null) showSetup(null);
        else showWeb();
    }

    // ---------------- Sunucu kurulum ekranı ----------------
    private void showSetup(String message) {
        root.removeAllViews();
        ScrollView scroll = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(24);
        box.setPadding(pad, dp(48), pad, pad);
        scroll.addView(box);

        TextView title = new TextView(this);
        title.setText("Depo Takip");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(BRAND);
        box.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Depo bilgisayarına bağlanın. Bilgisayarda Ayarlar → Telefon bağlantısı ekranındaki QR kodu okutun veya adresi yazın.\n\nTelefon ile bilgisayar aynı Wi-Fi ağında olmalıdır.");
        sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        sub.setTextColor(Color.parseColor("#3C4B50"));
        sub.setPadding(0, dp(10), 0, dp(22));
        box.addView(sub);

        Button scan = primaryButton("Sunucuyu QR ile bul");
        scan.setOnClickListener(v -> { scanForSetup = true; startScan(); });
        box.addView(scan, fullWidth(dp(56)));

        TextView or = new TextView(this);
        or.setText("veya adresi elle girin");
        or.setGravity(Gravity.CENTER);
        or.setTextColor(Color.parseColor("#6B787C"));
        or.setPadding(0, dp(18), 0, dp(8));
        box.addView(or);

        setupInput = new EditText(this);
        setupInput.setHint("Örn. 192.168.1.20");
        setupInput.setSingleLine(true);
        setupInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        setupInput.setImeOptions(EditorInfo.IME_ACTION_GO);
        if (serverUrl != null) setupInput.setText(serverUrl);
        setupInput.setOnEditorActionListener((v, actionId, event) -> { tryConnect(setupInput.getText().toString()); return true; });
        box.addView(setupInput, fullWidth(ViewGroup.LayoutParams.WRAP_CONTENT));

        Button connect = secondaryButton("Bağlan");
        connect.setOnClickListener(v -> tryConnect(setupInput.getText().toString()));
        LinearLayout.LayoutParams lp = fullWidth(dp(52));
        lp.topMargin = dp(10);
        box.addView(connect, lp);

        setupStatus = new TextView(this);
        setupStatus.setPadding(0, dp(16), 0, 0);
        setupStatus.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        if (message != null) { setupStatus.setText(message); setupStatus.setTextColor(Color.parseColor("#B4322A")); }
        box.addView(setupStatus);

        TextView ver = new TextView(this);
        ver.setText("Sürüm " + appVersion());
        ver.setTextColor(Color.parseColor("#8A9A9C"));
        ver.setPadding(0, dp(30), 0, 0);
        box.addView(ver);

        root.addView(scroll, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private String normalizeUrl(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.isEmpty()) return null;
        if (!s.startsWith("http://") && !s.startsWith("https://")) s = "http://" + s;
        try {
            Uri u = Uri.parse(s);
            String host = u.getHost();
            if (host == null || host.isEmpty()) return null;
            int port = u.getPort();
            if (port == -1) port = 8765;
            return u.getScheme() + "://" + host + ":" + port;
        } catch (Exception e) {
            return null;
        }
    }

    private void tryConnect(String raw) {
        final String url = normalizeUrl(raw);
        if (url == null) { setStatus("Geçerli bir adres girin.", true); return; }
        setStatus("Bağlanılıyor: " + url + " …", false);
        new Thread(() -> {
            String err = null;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url + "/api/status").openConnection();
                c.setConnectTimeout(4000);
                c.setReadTimeout(4000);
                BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
                r.close();
                if (!sb.toString().contains("DepoTakip")) err = "Bu adreste Depo Takip sunucusu bulunamadı.";
            } catch (Exception e) {
                err = "Sunucuya ulaşılamadı. Bilgisayarın açık ve aynı Wi-Fi ağında olduğundan emin olun.";
            }
            final String error = err;
            runOnUiThread(() -> {
                if (error != null) { setStatus(error, true); return; }
                prefs.edit().putString(KEY_SERVER, url).apply();
                serverUrl = url;
                showWeb();
            });
        }).start();
    }

    private void setStatus(String text, boolean error) {
        if (setupStatus == null) return;
        setupStatus.setText(text);
        setupStatus.setTextColor(Color.parseColor(error ? "#B4322A" : "#3C4B50"));
    }

    // ---------------- WebView ----------------
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void showWeb() {
        root.removeAllViews();
        if (webView == null) {
            webView = new WebView(this);
            WebSettings s = webView.getSettings();
            s.setJavaScriptEnabled(true);
            s.setDomStorageEnabled(true);
            s.setDatabaseEnabled(true);
            s.setMediaPlaybackRequiresUserGesture(false);
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            s.setCacheMode(WebSettings.LOAD_DEFAULT);
            s.setUserAgentString(s.getUserAgentString() + " DepoTakipAndroid/" + appVersion());
            CookieManager.getInstance().setAcceptCookie(true);
            webView.addJavascriptInterface(new Bridge(), "DepoAndroid");
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri u = request.getUrl();
                    Uri base = Uri.parse(serverUrl);
                    if (u.getHost() != null && u.getHost().equals(base.getHost())) return false;
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                    return true;
                }

                @Override
                public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    if (request.isForMainFrame()) showOffline();
                }
            });
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                    if (fileCallback != null) fileCallback.onReceiveValue(null);
                    fileCallback = callback;
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"});
                    try { fileLauncher.launch(Intent.createChooser(i, "Excel dosyası seçin")); }
                    catch (Exception e) { fileCallback = null; return false; }
                    return true;
                }
            });
            webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) ->
                    startDownload(url, contentDisposition, mimetype));
            webView.loadUrl(serverUrl + "/");
        }
        if (webView.getParent() != null) ((ViewGroup) webView.getParent()).removeView(webView);
        root.addView(webView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void showOffline() {
        root.removeAllViews();
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        int pad = dp(28);
        box.setPadding(pad, pad, pad, pad);
        TextView t = new TextView(this);
        t.setText("Sunucuya bağlanılamadı");
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setTextColor(BRAND);
        t.setGravity(Gravity.CENTER);
        box.addView(t);
        TextView d = new TextView(this);
        d.setText("Adres: " + serverUrl + "\n\nDepo bilgisayarının açık olduğundan ve telefonun aynı Wi-Fi ağına bağlı olduğundan emin olun.");
        d.setGravity(Gravity.CENTER);
        d.setPadding(0, dp(12), 0, dp(24));
        d.setTextColor(Color.parseColor("#3C4B50"));
        box.addView(d);
        Button retry = primaryButton("Tekrar dene");
        retry.setOnClickListener(v -> { showWeb(); webView.loadUrl(serverUrl + "/"); });
        box.addView(retry, fullWidth(dp(54)));
        Button change = secondaryButton("Sunucu adresini değiştir");
        change.setOnClickListener(v -> showSetup(null));
        LinearLayout.LayoutParams lp = fullWidth(dp(50));
        lp.topMargin = dp(10);
        box.addView(change, lp);
        root.addView(box, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void startDownload(String url, String contentDisposition, String mimetype) {
        try {
            String name = URLUtil.guessFileName(url, contentDisposition, mimetype);
            if (name == null || name.endsWith(".bin")) name = "DepoTakip_" + System.currentTimeMillis() + ".xlsx";
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            r.setTitle(name);
            r.setDescription("Depo Takip");
            r.setMimeType(mimetype != null && !mimetype.isEmpty() ? mimetype : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            dm.enqueue(r);
            Toast.makeText(this, "İndiriliyor: " + name + " (İndirilenler klasörü)", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "İndirme başlatılamadı: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    // ---------------- QR tarama ----------------
    private void startScan() {
        try {
            GmsBarcodeScannerOptions opts = new GmsBarcodeScannerOptions.Builder()
                    .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                    .enableAutoZoom()
                    .build();
            GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(this, opts);
            scanner.startScan()
                    .addOnSuccessListener(barcode -> onScanResult(barcode.getRawValue()))
                    .addOnCanceledListener(this::onScanCancelled)
                    .addOnFailureListener(e -> startZxing());
        } catch (Exception e) {
            startZxing();
        }
    }

    private void startZxing() {
        ScanOptions o = new ScanOptions();
        o.setDesiredBarcodeFormats(ScanOptions.QR_CODE);
        o.setPrompt("QR kodu çerçevenin içine getirin");
        o.setBeepEnabled(true);
        o.setOrientationLocked(false);
        zxingLauncher.launch(o);
    }

    private void onScanResult(String text) {
        if (text == null) { onScanCancelled(); return; }
        if (scanForSetup) {
            scanForSetup = false;
            if (setupInput != null) setupInput.setText(text);
            tryConnect(text);
            return;
        }
        if (webView != null) webView.evaluateJavascript("window.__onNativeScan && window.__onNativeScan(" + JSONObject.quote(text) + ")", null);
    }

    private void onScanCancelled() {
        if (scanForSetup) { scanForSetup = false; return; }
        if (webView != null) webView.evaluateJavascript("window.__onNativeScanCancel && window.__onNativeScanCancel()", null);
    }

    // ---------------- Bildirim ----------------
    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Stok uyarıları", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Asgari stok seviyesinin altına inen hammaddeler");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private void showNotification(String title, String body) {
        if (Build.VERSION.SDK_INT >= 33 &&
                ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notify)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setColor(BRAND)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pi)
                .setAutoCancel(true);
        try { NotificationManagerCompat.from(this).notify(notifId++, b.build()); } catch (SecurityException ignored) { }
    }

    // ---------------- Web köprüsü ----------------
    private class Bridge {
        @JavascriptInterface
        public void scanQR() { runOnUiThread(() -> { scanForSetup = false; startScan(); }); }

        @JavascriptInterface
        public void notify(String title, String body) { runOnUiThread(() -> showNotification(title, body)); }

        @JavascriptInterface
        public void print(String jobName) {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                String name = jobName == null || jobName.isEmpty() ? "Depo Takip" : jobName;
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(name);
                pm.print(name, adapter, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            });
        }

        @JavascriptInterface
        public void changeServer() { runOnUiThread(() -> showSetup(null)); }

        @JavascriptInterface
        public String getVersion() { return appVersion(); }

        @JavascriptInterface
        public void download(String url) { runOnUiThread(() -> startDownload(url, null, null)); }
    }

    // ---------------- Yardımcılar ----------------
    private String appVersion() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
        catch (Exception e) { return "?"; }
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private LinearLayout.LayoutParams fullWidth(int height) {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, height);
    }

    private Button primaryButton(String text) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        b.setTextColor(Color.WHITE);
        b.setBackgroundColor(BRAND);
        return b;
    }

    private Button secondaryButton(String text) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        b.setTextColor(BRAND);
        b.setBackgroundColor(Color.parseColor("#E0EEEE"));
        return b;
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }
}
