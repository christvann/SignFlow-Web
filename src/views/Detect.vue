<template>
  <div class="min-h-screen bg-gray-200 p-6">
    <h2 class="text-2xl font-bold mb-4 text-center">🔍 Deteksi Handsign</h2>
    <div class="flex flex-col md:flex-row gap-6 justify-center">
      <div class="relative w-full md:w-2/3 bg-black rounded-lg overflow-hidden shadow-md">
        <video ref="video" autoplay muted playsinline class="w-full h-auto"></video>
        <canvas ref="canvas" class="absolute top-0 left-0 w-full h-full pointer-events-none"></canvas>
      </div>
      <div class="w-full md:w-1/3 bg-white p-4 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-2">Hasil Deteksi:</h3>
        <div class="text-xl font-mono text-blue-600 whitespace-pre-line">{{ detectedText }}</div>
        <!-- Hasil Deteksi Hand-To-Text -->
        <div class="mt-4 font-semibold text-lg text-black">📝 Kalimat : {{ sentence.join(" ") }}</div>
        <hr class="my-8 border-[#6C757D] sm:mx-auto dark:border-[#6C757D] lg:my-8" />
        <div class="mt-8 flex flex-col gap-2 px-2">
          <button class="bg-[#FFFFFF] border-[#28A745] border-[2px] hover:bg-[#DCFCE7] cursor-pointer transition-all py-2 rounded font-semibold" @click="startCamera">Mulai Kamera</button>
          <button class="bg-[#FFFFFF] border-[#C53830] border-[2px] hover:bg-[#FEE2E2] cursor-pointer transition-all py-2 rounded font-semibold" @click="stopCamera">Matikan Kamera</button>
          <button class="bg-[#FFFFFF] border-[#E0A800] border-[2px] hover:bg-[#FEF3C7] cursor-pointer transition-all py-2 rounded font-semibold" @click="resetText">Reset</button>
          <button class="bg-[#FFFFFF] border-[#6C757D] border-[2px] hover:bg-[#E2E3E5] cursor-pointer transition-all py-2 rounded font-semibold" @click="undoLastWord">Hapus Kata</button>
          <button class="bg-[#FFFFFF] border-[#007BFF] border-[2px] hover:bg-[#DBEAFE] cursor-pointer transition-all py-2 rounded font-semibold" @click="speakSentence">🔊 Ucapkan Kalimat</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as tf from "@tensorflow/tfjs";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

const video = ref(null);
const canvas = ref(null);
const detectedText = ref("Belum ada gesture");
const sentence = ref([]);
let model = null;
const labels = ref([]);
const isModelLoaded = ref(false);
let camera = null;

// timer untuk jeda antar kata (ms)
let lastDetectionTime = 0;
const detectionInterval = 1500; // 1.5 detik

function updateSentence(newWord) {
  const lastWord = sentence.value[sentence.value.length - 1];
  if (newWord !== lastWord) {
    sentence.value.push(newWord);
    if (sentence.value.length > 20) sentence.value.shift(); // batas kalimat
  }
}

const resetText = () => {
  detectedText.value = "Belum ada gesture";
  sentence.value = [];
};

const undoLastWord = () => {
  if (sentence.value.length > 0) sentence.value.pop();
};

const speakSentence = () => {
  const text = sentence.value.join(" ");
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "id-ID";
  utterance.voice = speechSynthesis.getVoices().find((v) => v.lang === "id-ID" && v.name.includes("male")) || null;
  speechSynthesis.speak(utterance);
};

onMounted(async () => {
  try {
    detectedText.value = "⏳ Memuat model...";
    await tf.setBackend("webgl");
    await tf.ready();

    if (!tf.engine()?.backend) throw new Error("Backend belum siap!");

    console.log("✅ Backend aktif:", tf.getBackend());
    model = await tf.loadLayersModel("/tfjs_model/model.json");
    const res = await fetch("/labels.json");
    labels.value = await res.json();

    if (!model || labels.value.length === 0) throw new Error("Model/label tidak valid.");
    isModelLoaded.value = true;
    detectedText.value = "✅ Model siap digunakan";
  } catch (err) {
    console.error("❌ Gagal memuat model:", err);
    detectedText.value = "❌ Gagal memuat model";
  }
});

const startCamera = () => {
  if (!video.value || !canvas.value || !isModelLoaded.value) return console.warn("⚠️ Tidak siap");

  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
  });

  hands.onResults(onResults);

  camera = new Camera(video.value, {
    onFrame: async () => {
      try {
        await hands.send({ image: video.value });
      } catch (err) {
        console.error("❌ hands.send error:", err);
      }
    },
    width: 640,
    height: 480,
  });

  camera.start();
};

const stopCamera = () => {
  if (camera) {
    camera.stop();
    camera = null;
  }
  const ctx = canvas.value.getContext("2d");
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
  detectedText.value = "Belum ada gesture";
};

const onResults = async (results) => {
  if (!model || !isModelLoaded.value || !tf.engine()?.backend) return;

  const ctx = canvas.value.getContext("2d");
  const width = video.value.videoWidth;
  const height = video.value.videoHeight;
  canvas.value.width = width;
  canvas.value.height = height;
  ctx.clearRect(0, 0, width, height);

  if (results.multiHandLandmarks?.length > 0) {
    let highestConfidence = 0;
    let bestLabel = "";
    let displayTexts = [];

    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      drawConnectors(ctx, landmarks, Hands.HAND_CONNECTIONS, { color: "#0f0", lineWidth: 2 });
      drawLandmarks(ctx, landmarks, { color: "#00f", radius: 3 });

      try {
        const inputTensor = tf.tensor([landmarks.flatMap((p) => [p.x, p.y, p.z])], [1, 63], "float32");
        const prediction = model.predict(inputTensor);
        const scores = prediction.dataSync();
        const maxIndex = scores.indexOf(Math.max(...scores));
        const confidence = scores[maxIndex];
        const label = labels.value[maxIndex];
        const confidencePercent = (confidence * 100).toFixed(1);

        displayTexts.push(`Tangan ${i + 1}: ${label} (${confidencePercent}%)`);

        // simpan label terbaik jika confidence cukup tinggi
        if (confidence > 0.5 && confidence > highestConfidence) {
          highestConfidence = confidence;
          bestLabel = label;
        }

        inputTensor.dispose();
        prediction.dispose?.();
      } catch (err) {
        console.error(`❌ Predict Error - Tangan ${i + 1}:`, err);
        displayTexts.push(`Tangan ${i + 1}: error`);
      }
    }

    // menambahkan ke display jika ada label terbaik & sudah lewat jeda
    const now = Date.now();
    if (bestLabel && now - lastDetectionTime >= detectionInterval) {
      updateSentence(bestLabel);
      lastDetectionTime = now;
    }

    detectedText.value = displayTexts.join("\n");
  } else {
    detectedText.value = "✋ Tangan tidak terdeteksi";
  }
};

onBeforeUnmount(() => {
  stopCamera();
});
</script>
