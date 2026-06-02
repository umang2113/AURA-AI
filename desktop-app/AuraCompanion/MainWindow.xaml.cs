using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Controls;
using System.Runtime.InteropServices;

namespace AuraCompanion
{
    public partial class MainWindow : Window
    {
        // Win32 API Imports for Global Hotkey Registration
        [DllImport("user32.dll")]
        private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

        [DllImport("user32.dll")]
        private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        private const uint MOD_WIN = 0x0008;
        private const uint VK_SPACE = 0x0020;
        private const int HOTKEY_ID = 9000;

        private IntPtr _windowHandle;
        private HwndSource _source;
        private readonly HttpClient _httpClient;

        public MainWindow()
        {
            InitializeComponent();
            _httpClient = new HttpClient();
            
            // Set window position to bottom right of screen
            double screenWidth = SystemParameters.PrimaryScreenWidth;
            double screenHeight = SystemParameters.PrimaryScreenHeight;
            this.Left = screenWidth - this.Width - 20;
            this.Top = screenHeight - this.Height - 60;
        }

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            _windowHandle = new WindowInteropHelper(this).Handle;
            _source = HwndSource.FromHwnd(_windowHandle);
            _source.AddHook(HwndHook);

            // Register Hotkey: Win + Space
            RegisterHotKey(_windowHandle, HOTKEY_ID, MOD_WIN, VK_SPACE);
        }

        private IntPtr HwndHook(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            const int WM_HOTKEY = 0x0312;
            if (msg == WM_HOTKEY && wParam.ToInt32() == HOTKEY_ID)
            {
                // WAKE UP WIDGET ON WIN + SPACE
                TriggerVoiceRecognition();
                handled = true;
            }
            return IntPtr.Zero;
        }

        private void TriggerVoiceRecognition()
        {
            // Simulate wake status toggle
            AddChatMessage("System", "Speech recognition triggered globally via Win+Space...");
            // Starts audio hardware pipeline in production
        }

        private async void SendMessageToAura(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;

            AddChatMessage("User", text);
            ManualInputBox.Clear();

            try
            {
                var payload = new
                {
                    message = text,
                    mode = "aura", // Default to Aura Pro (Professional Mode)
                    history = new object[] { }
                };

                string json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                // Dispatch call to Node.js backend express API
                HttpResponseMessage response = await _httpClient.PostAsync("http://localhost:5000/api/chat", content);

                if (response.IsSuccessStatusCode)
                {
                    string responseString = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(responseString);
                    string reply = doc.RootElement.GetProperty("reply").GetString();
                    
                    AddChatMessage("AURA", reply);
                }
                else
                {
                    AddChatMessage("System", "Error communicating with AURA brain API.");
                }
            }
            catch (Exception ex)
            {
                AddChatMessage("System", $"Network Connection Failure: {ex.Message}");
            }
        }

        private void AddChatMessage(string sender, string message)
        {
            var textBlock = new TextBlock
            {
                Text = $"{sender.ToUpper()}: {message}",
                Foreground = sender == "User" ? System.Windows.Media.Brushes.Cyan : System.Windows.Media.Brushes.White,
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 2, 0, 8),
                FontSize = 12
            };

            ChatHistoryStack.Children.Add(textBlock);
        }

        private void SendButton_Click(object sender, RoutedEventArgs e)
        {
            SendMessageToAura(ManualInputBox.Text);
        }

        private void ManualInputBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                SendMessageToAura(ManualInputBox.Text);
            }
        }

        private void ManualInputBox_GotFocus(object sender, RoutedEventArgs e)
        {
            // Reset manual placeholders
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }

        protected override void OnClosed(EventArgs e)
        {
            _source.RemoveHook(HwndHook);
            UnregisterHotKey(_windowHandle, HOTKEY_ID);
            base.OnClosed(e);
        }
    }
}
