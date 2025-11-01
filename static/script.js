const chatBox = document.getElementById("chat");
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

function appendMessage(text, who = "bot") {
  const msg = document.createElement("div");
  msg.className = `msg ${who}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerText = text;
  msg.appendChild(bubble);
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  input.value = "";
  appendMessage("Thinking...", "bot");

  try {
    const response = await fetch('http://localhost:5000/chat', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const data = await response.json();
    chatBox.lastChild.remove(); // remove "Thinking..."

    if (data.error) {
      appendMessage("Error: " + data.error, "bot");
    } else {
      appendMessage(data.reply, "bot");
    }
  } catch (error) {
    chatBox.lastChild.remove();
    appendMessage("Network error. Check the server console.", "bot");
    console.error(error);
  }
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});
