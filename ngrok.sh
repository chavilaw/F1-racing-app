# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "ngrok not found!"
    echo ""
    echo "Install it with:"
    echo "  brew install ngrok/ngrok/ngrok"
    echo ""
    echo "Then sign up at https://dashboard.ngrok.com/signup"
    echo "And configure: ngrok config add-authtoken ur-token-from-the-webpage"
    exit 1
fi

# Start ngrok tunnel on port 3000
echo "✅ Starting tunnel: http://localhost:3000 → https://YOUR_URL.ngrok-free.app"
echo ""
echo "📱 Share the Forwarding URL with testers!"
echo "   (URL changes each time you restart ngrok)"
echo ""
echo "Press Ctrl+C to stop ngrok"
echo ""

ngrok http 3000

