<template>
  <div class="min-h-screen bg-gray-200 p-6">
    <h2 class="text-2xl font-semibold mb-4 text-center">Deteksi Handsign</h2>
    <div class="flex flex-col md:flex-row justify-center items-start gap-6">
      <!-- Video + Canvas -->
      <div class="w-full md:w-2/3 relative rounded-lg overflow-hidden shadow-md bg-black">
        <video ref="video" class="w-full h-auto" autoplay muted playsinline></video>
        <canvas ref="canvas" class="absolute top-0 left-0 w-full h-full pointer-events-none"></canvas>
      </div>
      <!-- Output -->
      <div class="w-full md:w-1/3 bg-white p-4 rounded-lg shadow-md">
        <h3 class="text-xl font-bold mb-2">Hasil Deteksi:</h3>
        <div class="text-2xl font-mono text-blue-600 whitespace-pre-line">
          {{ detectedText }}
        </div>
        <div class="mt-6 flex flex-col gap-2">
          <button class="bg-green-500 hover:bg-green-600 text-white py-2 rounded" @click="startCamera">Mulai Kamera</button>
          <button class="bg-red-500 hover:bg-red-600 text-white py-2 rounded" @click="stopCamera">Berhenti</button>
          <button class="bg-gray-500 hover:bg-gray-600 text-white py-2 rounded" @click="resetText">Reset</button>
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

// Refs
const video = ref(null);
const canvas = ref(null);
const detectedText = ref("Belum ada gesture");

// Model
const model = ref(null);
const isModelLoaded = ref(false);
let camera = null;

// Label sesuai dengan dataset Anda
const labels = [
  "berdoa", "makan", "minum", "bapak", "ibu", "halo", "pergi", "datang",
  "ya", "tidak", "tolong", "maaf", "sakit", "senang", "sedih", "belajar",
  "main", "kerja", "selesai", "diam", "lainnya"
];

// Load model saat komponen mount
onMounted(async () => {
  try {
    detectedText.value = "⏳ Memuat model...";
    model.value = await tf.loadLayersModel("/tfjs_model/model.json");
    isModelLoaded.value = true;
    console.log("✅ Model berhasil dimuat:", model.value.summary());
    console.log("Input shape:", model.value.inputs[0].shape); // Harus [null, 63]
    detectedText.value = "✅ Model siap digunakan";
  } catch (error) {
    console.error("❌ Gagal memuat model:", error);
    detectedText.value = "❌ Gagal memuat model";
  }
});

// Mulai kamera dan deteksi tangan
const startCamera = async () => {
  if (!video.value || !canvas.value || !isModelLoaded.value) return;

  const hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  hands.onResults(onResults);

  camera = new Camera(video.value, {
    onFrame: async () => {
      await hands.send({ image: video.value });
    },
    width: 640,
    height: 480,
  });

  camera.start();
};

// Berhenti dari deteksi
const stopCamera = () => {
  if (camera) {
    camera.stop();
    camera = null;
  }
  detectedText.value = "Belum ada gesture";

  const ctx = canvas.value.getContext("2d");
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
};

// Reset teks
const resetText = () => {
  detectedText.value = "Belum ada gesture";
};

// Fungsi utama untuk menangani hasil deteksi
const onResults = async (results) => {
  console.log("📊 Hasil deteksi MediaPipe Hands:", results);

  const ctx = canvas.value?.getContext("2d");
  const width = video.value?.videoWidth ?? 640;
  const height = video.value?.videoHeight ?? 480;

  if (ctx && canvas.value) {
    canvas.value.width = width;
    canvas.value.height = height;
    ctx.clearRect(0, 0, width, height);
  }

  if (
    results &&
    results.multiHandLandmarks &&
    results.multiHandLandmarks.length > 0
  ) {
    const landmarks = results.multiHandLandmarks[0];

    // Gambar landmark dan konektor
    if (ctx) {
      drawConnectors(ctx, landmarks, Hands.HAND_CONNECTIONS, {
        color: "#0f0",
        lineWidth: 2,
      });
      drawLandmarks(ctx, landmarks, { color: "#00f", radius: 3 });
    }

    // Hitung kotak pembatas (bounding box)
    const bbox = calculateBoundingBox(landmarks);
    if (ctx) {
      ctx.strokeStyle = "#f00";
      ctx.lineWidth = 2;
      ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
    }

    try {
      // Buat input tensor [1, 63]
      const flatLandmarks = landmarks.flatMap((p) => [p.x, p.y, p.z]);

      // Debugging
      console.log("🧮 Landmark data:", flatLandmarks);
      const input = tf.tensor(flatLandmarks).reshape([1, 63]);
      console.log("🧠 Input Tensor Shape:", input.shape); // Harus [1, 63]

      // Prediksi menggunakan model
      const prediction = model.value.predict(input);
      const result = await prediction.argMax(-1).data();
      const labelIndex = result[0];

      // Tampilkan hasil
      detectedText.value = labels[labelIndex] || "Tidak dikenali";
    } catch (e) {
      console.error("🚨 Error saat prediksi:", e);
      detectedText.value = "Error saat prediksi";
    }
  } else {
    detectedText.value = "✋ Tangan tidak terdeteksi";
  }
};

// Fungsi bantu: menghitung bounding box
const calculateBoundingBox = (landmarks) => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  landmarks.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });

  const width = canvas.value?.width ?? 640;
  const height = canvas.value?.height ?? 480;

  return {
    x: minX * width,
    y: minY * height,
    width: (maxX - minX) * width,
    height: (maxY - minY) * height,
  };
};

// Bersihkan kamera saat komponen unmount
onBeforeUnmount(() => {
  stopCamera();
});
</script>