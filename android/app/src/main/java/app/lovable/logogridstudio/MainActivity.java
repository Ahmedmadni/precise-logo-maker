package app.lovable.logogridstudio;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override public void onCreate(android.os.Bundle state) {
    registerPlugin(NativeDocumentsPlugin.class);
    super.onCreate(state);
  }
}
