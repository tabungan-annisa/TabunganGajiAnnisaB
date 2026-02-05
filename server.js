// ========================= IMPORT MODULE =========================
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

// ========================= CORS =========================
const FRONTEND_URL = "http://localhost:3000/TabunganGajiAnnisa";

app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Handle preflight (OPTIONS)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", FRONTEND_URL);
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.sendStatus(200);
  }
  next();
});

// ========================= BODY PARSER =========================
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));

// ========================= MULTER =========================
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (req, file, cb) => {
    // Optional: batasi tipe file (boleh dihapus kalau tidak perlu)
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error("Tipe file tidak diizinkan. Maksimal JPG, PNG, atau PDF.")
      );
    }
    cb(null, true);
  },
});

// ========================= MULTER ERROR HANDLER =========================
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        result: "error",
        message: "Ukuran file maksimal 5 MB.",
      });
    }
  }

  if (err) {
    return res.status(400).json({
      result: "error",
      message: err.message,
    });
  }

  next();
});


// ========================= DEFAULT ROUTE =========================
app.get("/", (req, res) => {
  res.send("<h1>Ini adalah API Indikator KPI</h1>");
});

// ========================= REGISTER =========================
app.post("/api/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({
        result: "error",
        message: "Email, password, dan nama wajib diisi!",
      });
    }

    const response = await axios.post(GOOGLE_SCRIPT_URL, {
      action: "register",
      email,
      password,
      name,
    });

    res.json(response.data);
  } catch (error) {
    console.error("❌ Error register:", error.message);
    res.status(500).json({
      result: "error",
      message: "Terjadi kesalahan saat registrasi.",
    });
  }
});

// ========================= LOGIN =========================
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const response = await axios.post(GOOGLE_SCRIPT_URL, {
      action: "login",
      email,
      password,
    });

    res.json(response.data);
  } catch (error) {
    console.error("❌ Error login:", error.message);
    res.status(500).json({
      result: "error",
      message: "Terjadi kesalahan saat login.",
    });
  }
});

// ========================= KPI BATCH =========================
app.post("/api/kpi-batch", async (req, res) => {
  try {
    const { indikator_list, nama } = req.body;

    if (!Array.isArray(indikator_list) || indikator_list.length === 0) {
      return res.status(400).json({
        result: "error",
        message: "Indikator KPI tidak valid.",
      });
    }

    const indikatorResponse = await axios.post(GOOGLE_SCRIPT_URL, {
      action: "getIndikatorData",
    });

    if (indikatorResponse.data.result !== "success") {
      return res.status(500).json({
        result: "error",
        message: "Gagal validasi indikator (master data).",
      });
    }

    const indikatorMaster = indikatorResponse.data.message || [];

    for (const item of indikator_list) {
      const master = indikatorMaster.find(
        (m) => m.nama === nama && m.indikator_kpi === item.indikator_kpi
      );

      if (!master) {
        return res.status(400).json({
          result: "error",
          message: `Indikator "${item.indikator_kpi}" tidak ditemukan.`,
        });
      }

      const targetAsli = String(master.target || "").toLowerCase();
      const targetDikirim = String(item.target || "").toLowerCase();
      const isFluktuatif = targetAsli.includes("fluktuatif");

      if (!isFluktuatif && targetAsli !== targetDikirim) {
        return res.status(400).json({
          result: "error",
          message: `Target untuk indikator "${item.indikator_kpi}" tidak boleh diubah.`,
        });
      }
    }

    const payload = { action: "kpiBatch", ...req.body };
    const response = await axios.post(GOOGLE_SCRIPT_URL, payload);

    res.json(response.data);
  } catch (error) {
    console.error("❌ Error KPI Batch:", error.message);
    res.status(500).json({
      result: "error",
      message: "Gagal mengirim KPI.",
    });
  }
});

// ========================= GET INDIKATOR =========================
app.get("/api/indikator-data", async (req, res) => {
  try {
    const response = await axios.post(GOOGLE_SCRIPT_URL, {
      action: "getIndikatorData",
    });
    res.json(response.data);
  } catch (error) {
    console.error("❌ Error indikator:", error.message);
    res.status(500).json({
      result: "error",
      message: "Gagal mengambil indikator!",
    });
  }
});

// ========================= GET KPI USER ========================= 09,jan 26
app.get("/api/kpi-my", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        result: "error",
        message: "Email wajib dikirim",
      });
    }

    const response = await axios.post(GOOGLE_SCRIPT_URL, {
      action: "getKpiByUser",
      email,
    });

    res.json(response.data);
  } catch (error) {
    console.error("❌ Error get KPI user:", error.message);
    res.status(500).json({
      result: "error",
      message: "Gagal mengambil KPI user",
    });
  }
});

// ========================= UPDATE KPI =========================
app.post("/api/kpi-update", upload.single("buktiFile"), async (req, res) => {
  try {
    const buktiFile = req.file;

    if (buktiFile) {
      const maxSafeSize = 3 * 1024 * 1024; // 3 MB

      if (buktiFile.size > maxSafeSize) {
        return res.status(413).json({
          result: "error",
          message:
            "File terlalu besar. Maksimal 3 MB agar aman di sistem.",
        });
      }
    }

    // ⬇️ kode lama tetap


    let buktiBase64 = "";
    let mimeType = "";

    if (buktiFile) {
      buktiBase64 = buktiFile.buffer.toString("base64");
      mimeType = buktiFile.mimetype;
    }

    const response = await axios.post(GOOGLE_SCRIPT_URL, {
      action: "updateKPI",
      id: kpiKey,
      actual,
      email,
      bukti: buktiBase64
        ? `data:${mimeType};base64,${buktiBase64}`
        : "",
    });

    res.json(response.data);
  } catch (error) {
    console.error("❌ Error update KPI:", error.message);
    res.status(500).json({
      result: "error",
      message: "Gagal update KPI",
    });
  }
});

// ========================= GET KPI BY USER (DIVISI) =========================
app.post("/api/kpi-by-user", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        result: "error",
        message: "Email wajib dikirim",
      });
    }

    const response = await axios.post(GOOGLE_SCRIPT_URL, {
      action: "getKpiByUser",
      email,
    });

    res.json(response.data);
  } catch (error) {
    console.error("❌ Error get KPI by user:", error.message);
    res.status(500).json({
      result: "error",
      message: "Gagal mengambil data KPI",
    });
  }
});

app.post("/api/kpi-submitted", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        result: "error",
        message: "Email wajib dikirim",
      });
    }

    const response = await axios.post(GOOGLE_SCRIPT_URL, {
      action: "getSubmittedKPI",
      email,
    });

    res.json(response.data);
  } catch (error) {
    console.error("❌ Error get submitted KPI:", error.message);
    res.status(500).json({
      result: "error",
      message: "Gagal mengambil Tabungan yang sudah dikirim",
    });
  }
});


// ========================= LOCAL DEV ONLY =========================
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 Server lokal berjalan di http://localhost:${PORT}`);
  });
}


// ========================= EXPORT FOR VERCEL =========================
module.exports = app;

