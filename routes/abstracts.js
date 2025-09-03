import express from "express";
import { pool } from "../config/db.js";
import path from 'path';
import fs from 'fs';
import { validateAbstractStatus } from "../middleware/validation.js";
import multer from 'multer';

const TRACKS = [
  {
    value: "track_1",
    name: "Integrated Diagnostics, AMR, and Epidemic Readiness",
    subcategories: [
      "Optimizing Laboratory Diagnostics in Integrated Health Systems",
      "Quality management systems in Multi-Disease Diagnostics",
      "Leveraging Point-of-Care Testing to Enhance Integrated Service Delivery",
      "Combatting Antimicrobial Resistance (AMR) Through Diagnostics",
      "Strengthening surveillance systems for drug resistance across TB, malaria, HIV, and bacterial infections",
      "Linking diagnostics to resistance monitoring: From lab to real-time policy response",
      "Role of Diagnostics in Early Warning Systems: lessons from recent outbreaks",
      "Expanding access to radiological services: Affordable imaging in low-resource settings"
    ]
  },
  {
    value: "track_2",
    name: "Digital Health, Data, and Innovation",
    subcategories: [
      "AI-powered diagnostics: Innovations and governance for TB, HIV, and cervical cancer",
      "Digital platforms for surveillance, early detection, and outbreak prediction",
      "Data interoperability and health information exchange: service delivery Integration and data/information systems, Gaps, ethics, and governance",
      "Community-led digital health: Mobile tools, and digital village health teams (VHTs)",
      "Localized health information systems: Capturing/collection, use of data at grass root and higher levels for fast action.",
      "Leveraging digital equity in urban and peri-urban health responses"
    ]
  },
  {
    value: "track_3",
    name: "Community Engagement for Disease Prevention and Elimination",
    subcategories: [
      "Catalyzing youth, community health extension workers (CHEWs), and grassroots champions for health innovation",
      "Integrating preventive services for communicable and non-communicable diseases, and mental health at household level",
      "Scaling community-led elimination efforts: Malaria, TB, neglected tropical diseases (NTDs), and leprosy and improving vaccine uptake",
      "Participatory planning, implementation, monitoring for behavior change, and social accountability"
    ]
  },
  {
    value: "track_4",
    name: "Health System Resilience and Emergency Preparedness and Response",
    subcategories: [
      "Sepsis and emergency triage protocols in fragile health systems",
      "Strengthening infection prevention and control (IPC) in primary care; including ready to use isolation facilities.",
      "Local vaccine and therapeutics; access, and emergency stockpiling",
      "Health workforce preparedness; Training multidisciplinary rapid response teams",
      "Continuity of care: Protecting essential health services during crises"
    ]
  },
  {
    value: "track_5",
    name: "Policy, Financing and Cross-Sector Integration",
    subcategories: [
      "Integrated financing models for chronic and infectious disease burdens",
      "Social determinant-sensitive policymaking: Urban health, empowering young people for improved health through education and intersectoral action",
      "National accountability frameworks for health performance",
      "Scaling UHC through service integration at the primary level",
      "Policy instruments for embedding health equity in national planning",
      "Implementation science and translation of results into policy"
    ]
  },
  {
    value: "track_6",
    name: "One Health",
    subcategories: [
      "Early warning systems and multi-sector coordination for zoonotic outbreaks",
      "Localizing One Health strategies: Successes and challenges at district level",
      "Public–private partnerships; Insurance, vouchers, and demand-side financing to reduce out-of-pocket expenditure",
      "Data harmonization between human and animal health sectors",
      "Nutrition and lifestyle for health",
      "Wildlife trade, food systems, and emerging health risks",
      "Preparing for climate-sensitive disease patterns and spillover threats",
      "Strengthening Biosafety and Biosecurity Systems to Prevent Zoonotic Spillovers",
      "Confronting Insecticide Resistance in Vectors: A One Health approach to sustaining vector control gains"
    ]
  },
  {
    value: "track_7",
    name: "Care, Treatment & Rehabilitation",
    subcategories: [
      "Innovations in equitable health services for acute and chronic diseases care delivery across primary levels",
      "Interface of communicable and non-communicable diseases (NCDs): Integrated models",
      "Role of traditional medicine in continuum of care",
      "Enhancing community trust and treatment adherence through culturally embedded care",
      "Digital decision-support tools for frontline clinicians in NCD and infectious disease management"
    ]
  },
  {
    value: "track_8",
    name: "Cross-Cutting Themes (Applicable to All Tracks)",
    subcategories: [
      "Health equity and inclusion in marginalized and urbanizing populations",
      "Urban health, infrastructure, and health service delivery adaptations",
      "Gender and youth empowerment in policy and practice",
      "Evidence and translation from research to policy implementation",
      "South-South collaboration and regional leadership in innovation",
      "Health professionals education including transformative teaching methods and competency-based training"
    ]
  }
];

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/abstracts/');
  },
  filename: function (req, file, cb) {
    cb(null, 'abstract_' + Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  }
});

const upload = multer({ storage: storage });

router.post("/", upload.single('file'), async (req, res) => {
  try {
    const {
      title,
      abstract,
      keywords,
      authors,
      email,
      institution,
      phone,
      track = 'research'
    } = req.body;

    // Simplified validation - only require essential fields
    // if (!title || !abstract || !authors || !email) {
    //   return res.status(400).json({ 
    //     error: "Title, abstract, authors, and email are required" 
    //   });
    // }

    // Check if file was uploaded
    // if (!req.file) {
    //   return res.status(400).json({ error: "Abstract file is required" });
    // }

    // Validate abstract content (keep the section requirements)
    const requiredSections = ["Background", "Methods", "Findings", "Conclusion"];
    const hasAllSections = requiredSections.every(section => 
      abstract.toLowerCase().includes(section.toLowerCase())
    );

    // if (!hasAllSections) {
    //   return res.status(400).json({ error: "Abstract must include Background, Methods, Findings, and Conclusion sections." });
    // }

    // const wordCount = abstract.trim().split(/\s+/).length;
    // if (wordCount > 300) {
    //   return res.status(400).json({ error: "Abstract must not exceed 300 words." });
    // }

    // Fixed INSERT query to match actual database schema
    const insertQuery = `INSERT INTO abstracts(
        title,
        abstract,
        keywords,
        track,
        authors,
        corresponding_author_email,
        institution,
        phone,
        fileName,
        filePath,
        fileSize,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', NOW(), NOW())`;

    const [result] = await pool.query(insertQuery, [
      title,
      abstract,
      JSON.stringify(keywords || []),
      track,
      JSON.stringify(authors),
      email,
      institution || null,
      phone || null,
      req.file.originalname, // fileName
      req.file.path, // filePath
      req.file.size, // fileSize
    ]);

    const [rows] = await pool.query("SELECT * FROM abstracts WHERE id = ?", [result.insertId]);
    res.status(201).json({
      message: "Abstract submitted successfully and is under review",
      abstract: rows[0],
      status: "submitted"
    });

  } catch (error) {
    console.error("Error creating abstract:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM abstracts ORDER BY created_at DESC"
    );
    res.json({
      abstracts: rows,
      pagination: {
        total: rows.length,
        page: 1,
        limit: 20,
        pages: 1
      }
    });
  } catch (error) {
    console.error("Error fetching abstracts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/abstracts/download/:id - Download abstract file
router.get("/download/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query(
      "SELECT * FROM abstracts WHERE id = ?",
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Abstract not found" });
    }
    
    const abstract = rows[0];
    
    console.log('Abstract data:', {
      id: abstract.id,
      title: abstract.title,
      file_url: abstract.file_url,
      has_file_url: !!abstract.file_url
    });
    
    if (!abstract.file_url) {
      return res.status(404).json({ error: "No file attached to this abstract" });
    }
    
    // Parse the file_url JSON
    let fileInfo;
    try {
      fileInfo = JSON.parse(abstract.file_url);
    } catch (e) {
      return res.status(400).json({ error: "Invalid file information" });
    }
    
    const fileName = fileInfo.name || `abstract-${abstract.id}.pdf`;
    const fileType = fileInfo.type || 'application/pdf';
    
    // For now, return the file info as JSON since files are stored in frontend
    // In production, you would serve the actual file from the file system
    res.json({
      message: "File download information",
      abstract: {
        id: abstract.id,
        title: abstract.title,
        fileName: fileName,
        fileType: fileType,
        fileSize: fileInfo.size
      },
      downloadUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/uploads/abstracts/${fileName}`
    });
    
  } catch (error) {
    console.error("Error downloading abstract file:", error);
    res.status(500).json({ error: "Failed to download file" });
  }
});

// DELETE /api/abstracts/:id - Delete abstract
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if abstract exists
    const [rows] = await pool.query(
      "SELECT * FROM abstracts WHERE id = ?",
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Abstract not found" });
    }
    
    const abstract = rows[0];
    
    // Delete the file if it exists
    if (abstract.file_url && fs.existsSync(abstract.file_url)) {
      try {
        fs.unlinkSync(abstract.file_url);
      } catch (fileError) {
        console.warn("Could not delete file:", fileError);
      }
    }
    
    // Delete from database
    await pool.query("DELETE FROM abstracts WHERE id = ?", [id]);

    res.json({
      message: "Abstract deleted successfully",
      deletedId: id 
    });
    
  } catch (error) {
    console.error("Error deleting abstract:", error);
    res.status(500).json({ error: "Failed to delete abstract" });
  }
});

// PATCH /api/abstracts/:id/status - Update abstract status
router.patch("/:id/status", validateAbstractStatus, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewComments } = req.body;
    
    
    // Check if abstract exists
    const [rows] = await pool.query(
      "SELECT * FROM abstracts WHERE id = ?",
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Abstract not found" });
    }
    
    // Update abstract status
    await pool.query(
      "UPDATE abstracts SET status = ?, reviewComments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [status, reviewComments || null, id]
    );
    
    // Get updated abstract
    const [updatedRows] = await pool.query(
      "SELECT * FROM abstracts WHERE id = ?",
      [id]
    );

    res.json({
      message: "Abstract status updated successfully",
      abstract: updatedRows[0]
    });
    
  } catch (error) {
    console.error("Error updating abstract status:", error);
    res.status(500).json({ error: "Failed to update abstract status" });
  }
});

// PUT /api/abstracts/:id - Update entire abstract
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      abstract: abstractText, 
      keywords, 
      authors, 
      track, 
      subcategory, 
      format 
    } = req.body;
    
    // Check if abstract exists
    const [rows] = await pool.query(
      "SELECT * FROM abstracts WHERE id = ?",
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Abstract not found" });
    }
    
    // Update abstract
    await pool.query(
      `UPDATE abstracts SET 
        title = ?, 
        abstract = ?, 
        keywords = ?, 
        authors = ?, 
        track = ?, 
        subcategory = ?, 
        format = ?, 
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?`,
      [
        title,
        abstractText,
        JSON.stringify(keywords || []),
        JSON.stringify(authors),
        track,
        subcategory,
        format,
        id
      ]
    );
    
    // Get updated abstract
    const [updatedRows] = await pool.query(
      "SELECT * FROM abstracts WHERE id = ?",
      [id]
    );

    res.json({
      message: "Abstract updated successfully",
      abstract: updatedRows[0]
    });
    
  } catch (error) {
    console.error("Error updating abstract:", error);
    res.status(500).json({ error: "Failed to update abstract" });
  }
});

export default router;
