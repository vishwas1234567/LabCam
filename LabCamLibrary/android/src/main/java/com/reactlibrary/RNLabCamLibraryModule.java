
package com.reactlibrary;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Environment;
import android.os.Handler;
import android.support.annotation.Nullable;
import android.support.v4.app.NotificationCompat;
import android.telephony.TelephonyManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.common.annotations.VisibleForTesting;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

public class RNLabCamLibraryModule extends ReactContextBaseJavaModule {

  private final ReactApplicationContext reactContext;


  public static final String NOTIFICATION_CHANNEL_ID = "10001";
  private NotificationCompat.Builder mBuilder;

  JobScheduler jobScheduler;


  @VisibleForTesting
  private static final String REACT_CLASS = "RNLabCamLibrary";

  private static String DATA_PATH = Environment.getExternalStorageDirectory().toString() + File.separator;

  public RNLabCamLibraryModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    if (!this.DATA_PATH.contains(reactContext.getPackageName()))
      this.DATA_PATH += reactContext.getPackageName() + File.separator;
  }

  @Override
  public String getName() {
    return "RNLabCamLibrary";
  }


  @Override
  public Map<String, Object> getConstants() {
    final Map<String, Object> constants = new HashMap<>();
    return constants;
  }


  @ReactMethod
  public void startService() {

    new Handler().postDelayed(new Runnable() {
      @Override
      public void run() {
        String netInfo = getNetworkType();
        if (!netInfo.equalsIgnoreCase("none")) {
          jobScheduler = (JobScheduler) reactContext.getSystemService(Context.JOB_SCHEDULER_SERVICE);
          jobScheduler.schedule(new JobInfo.Builder(0,
                  new ComponentName(reactContext, NetService.class))
                  .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                  .build());
        }
      }
    }, 3000);  // network change need around 2s to take effect
  }

  private String getNetworkType() {
    ConnectivityManager cm = (ConnectivityManager) reactContext.getSystemService(Context.CONNECTIVITY_SERVICE);
    NetworkInfo networkInfo = cm.getActiveNetworkInfo();
    if (networkInfo != null && networkInfo.getType() == ConnectivityManager.TYPE_MOBILE &&
            networkInfo.isConnected()) {
      return "cellular";
    } else if (networkInfo != null && networkInfo.getType() == ConnectivityManager.TYPE_WIFI &&
            networkInfo.isConnected()) {
      return "wifi";
    }
    return "none";
  }

  @ReactMethod
  public void stopService() {
    if (jobScheduler !=null) {
      jobScheduler.cancelAll();
    }
  }

  @ReactMethod
  public void showNotification() {
    mBuilder = new NotificationCompat.Builder(reactContext);
    mBuilder.setSmallIcon(R.drawable.app_images_icon_app);
    mBuilder.setContentTitle("LabCam")
            .setContentText("File Uploaded")
            .setAutoCancel(false);

    NotificationManager mNotificationManager = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);

    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O)
    {
      int importance = NotificationManager.IMPORTANCE_DEFAULT;
      NotificationChannel notificationChannel = new NotificationChannel(NOTIFICATION_CHANNEL_ID, "NOTIFICATION_CHANNEL_NAME", importance);
      notificationChannel.enableLights(false);
      notificationChannel.setVibrationPattern(new long[]{ 0 });
      notificationChannel.enableVibration(true);
      assert mNotificationManager != null;
      mBuilder.setChannelId(NOTIFICATION_CHANNEL_ID);
      mNotificationManager.createNotificationChannel(notificationChannel);
    }
    assert mNotificationManager != null;
    mNotificationManager.notify(0 /* Request Code */, mBuilder.build());
  }

  @ReactMethod
  public void hasSimCard(final Promise promise) {
    TelephonyManager telMgr = (TelephonyManager)
            reactContext.getSystemService(Context.TELEPHONY_SERVICE);
    int simState = telMgr.getSimState();
    boolean result = true;
    switch (simState) {
      case TelephonyManager.SIM_STATE_ABSENT:
        result = false; // 没有SIM卡
        break;
      case TelephonyManager.SIM_STATE_UNKNOWN:
        result = false;
        break;
    };
    promise.resolve(result);
  }

  @ReactMethod
  public void hasFlash(final Promise promise) {
    boolean hasFlash = reactContext.getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH);
    promise.resolve(hasFlash);
  }

  @ReactMethod
  public void recognize(String path, String lang, @Nullable ReadableMap tessOptions, Promise promise) {
    promise.resolve("");
  }

}