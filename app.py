import os
from openai import OpenAI
import random
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv("HF_TOKEN")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# --- Emergency / Crisis Handling ---
CRISIS_KEYWORDS = ["suicide", "kill myself", "end my life", "can't go on", "want to die"]
URGENT_PHYSICAL_KEYWORDS = ["dying", "chest pain", "can't breathe", "severe bleeding", "heart attack", "unconscious",
                            "stab", "shot"]
EMOTIONAL_DISTRESS_KEYWORDS = ["depressed", "hopeless", "panic", "anxious", "lonely"]

CHAT_SYSTEM_PROMPT = (
    "You are a friendly, empathetic, and professional virtual healthcare support assistant. "
    "If users mention suicidal thoughts or emergencies, you should not respond with advice — only show empathy "
    "and encourage them to seek immediate professional help. "
    "Otherwise, keep your replies short, warm, and easy to understand, "
    "Your primary goal is to provide users with accurate, safe, and educational wellness information. "
    "You can discuss topics such as physical health, mental well-being, nutrition, exercise, sleep, stress management, "
    "preventive care, and general healthy lifestyle habits. "
    "You MUST keep the word limit of 100, unless necessary. "

    "You must NOT diagnose medical conditions, prescribe medication, or provide personalized treatment plans. "
    "Always remind users that your information is for educational and informational purposes only, "
    "and that they should consult a qualified healthcare professional for diagnosis or treatment. "

    "If a question is unrelated to physical or mental health, politely refuse and redirect the user to stay on health-related topics. "
    "Maintain a warm, encouraging tone, but remain professional and factual. "
    "Avoid unnecessary repetition, speculation, or medical jargon unless clearly explained. "
    "Do not provide emergency medical advice. If a user appears to be in crisis or describes urgent symptoms, "
    "respond with empathy and instruct them to contact emergency services or a licensed medical provider immediately. "

    "Keep responses concise, friendly, and easy to understand. "
    "Whenever appropriate, end responses with a short reminder to consult a doctor or healthcare professional. "
)

NUTRITION_SCAN_PROMPT = (
    "You are a nutrition facts scanner. Analyze the nutrition label image and extract the following information in EXACT JSON format: "
    "{\"calories\": number, \"fat\": number, \"carbohydrates\": number, \"sugar\": number, \"protein\": number, \"serving_size\": string}. "
    "Only return the JSON object, no additional text. If any value is not available, use null. "
    "Make sure to extract the numerical values only (without units). For example, if it says 'Calories: 250', return 250. "
    "If the label shows values per container with multiple servings, try to estimate per serving or use the per serving values."
)


def try_huggingface_model(message):
    """Try a specific Hugging Face model with the OpenAI-style client API"""
    try:
        client = OpenAI(
            base_url="https://router.huggingface.co/v1",
            api_key=TOKEN
        )

        completion = client.chat.completions.create(
            model="AndresR2909/Llama-3.1-8B-Instruct-suicide-related-text-classification:featherless-ai",
            messages=[
                {"role": "system", "content": CHAT_SYSTEM_PROMPT},
                {"role": "user", "content": message}
            ],
        )

        return completion.choices[0].message.content

    except Exception as e:
        print("Error:", e)
        return None


def scan_nutrition_facts(image_data):
    """Scan nutrition facts from image using OpenRouter"""
    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
        )

        completion = client.chat.completions.create(
            model="openai/gpt-4o-mini",  # Using a model that supports vision
            messages=[
                {
                    "role": "system",
                    "content": NUTRITION_SCAN_PROMPT
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extract nutrition facts from this label in JSON format."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}},
                    ],
                }
            ],
            max_tokens=500
        )

        response = completion.choices[0].message.content
        # Clean the response to extract JSON
        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            import json
            nutrition_data = json.loads(json_match.group())
            return nutrition_data
        else:
            return None

    except Exception as e:
        print(f"Nutrition scan error: {e}")
        return None


@app.route("/chat", methods=["POST"])
def chat():
    data = request.json or {}
    message = data.get("message", "").strip()

    if not message:
        return jsonify({"error": "Empty message"}), 400

    msg_lower = message.lower()

    # Crisis situation (immediate danger)
    for keyword in CRISIS_KEYWORDS:
        if keyword in msg_lower:
            return jsonify({
                "reply": (
                    "🚨 It sounds like you might be in crisis or thinking about self-harm. "
                    "You're not alone — please reach out for immediate help:\n"
                    "📞 Call your local emergency number (e.g., 911 / 112 / 999), or\n"
                    "💬 Contact a suicide helpline such as 988 (US), Samaritans (UK: 116 123), or Befrienders (MY).\n"
                    "Please get help right now — you deserve care and safety."
                ),
                "source": "crisis"
            })

    # Urgent physical medical situation
    for keyword in URGENT_PHYSICAL_KEYWORDS:
        if keyword in msg_lower:
            return jsonify({
                "reply": (
                    "🚨 This sounds like a medical emergency. "
                    "Please call emergency services (911 / 112 / 999) or go to the nearest hospital immediately."
                ),
                "source": "emergency"
            })

    # Emotional distress (non-crisis but concerning)
    for keyword in EMOTIONAL_DISTRESS_KEYWORDS:
        if keyword in msg_lower:
            return jsonify({
                "reply": (
                    "💬 It sounds like you're going through a tough time. "
                    "You're not alone — reaching out to a trusted friend, counselor, or mental health professional can really help. "
                    "If things feel overwhelming, you can also contact a local helpline for support."
                ),
                "source": "distress"
            })

    # --- Regular AI Response ---
    reply = None
    source = "fallback"

    if TOKEN:
        reply = try_huggingface_model(message)
        if reply:
            source = "huggingface_ai"

    # Fallback if AI gives no answer
    if not reply:
        fallback_responses = [
            "I understand your concern. For proper medical care, please consult a healthcare professional.",
            "Thanks for reaching out. It's best to speak with a doctor for personalized advice.",
            "I appreciate your message. Please consult a licensed healthcare provider for detailed guidance."
        ]
        reply = random.choice(fallback_responses)
        source = "fallback"

    return jsonify({"reply": reply, "source": source})


@app.route("/scan-nutrition", methods=["POST"])
def scan_nutrition():
    """Endpoint to scan nutrition facts from image"""
    try:
        data = request.json or {}
        image_data = data.get("image")

        if not image_data:
            return jsonify({"error": "No image data provided"}), 400

        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        nutrition_data = scan_nutrition_facts(image_data)

        if nutrition_data:
            return jsonify({
                "success": True,
                "nutrition_data": nutrition_data
            })
        else:
            return jsonify({
                "success": False,
                "error": "Could not extract nutrition facts from the image. Please ensure the nutrition label is clear and try again."
            }), 400

    except Exception as e:
        print(f"Scan nutrition error: {e}")
        return jsonify({
            "success": False,
            "error": "An error occurred while processing the image. Please try again."
        }), 500


@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    print("Starting MediBot with nutrition scanning at http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)