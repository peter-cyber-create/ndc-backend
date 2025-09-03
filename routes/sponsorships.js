
import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// POST /api/sponsorships - Create new sponsorship application
router.post('/', async (req, res) => {
  try {
    const {
      companyName,
      contactPerson,
      email,
      phone,
      website,
      industry,
      specialRequirements,
      selectedPackage
    } = req.body;

    // Explicit validation for required fields
    const missingFields = [];
    if (!companyName) missingFields.push('companyName');
    if (!contactPerson) missingFields.push('contactPerson');
    if (!email) missingFields.push('email');
    if (!selectedPackage) missingFields.push('selectedPackage');
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Map display names to database values
    const packageMapping = {
      'Platinum Sponsor': 'platinum',
      'Gold Sponsor': 'gold',
      'Silver Sponsor': 'silver',
      'Bronze Sponsor': 'bronze',
      'platinum': 'platinum',
      'gold': 'gold',
      'silver': 'silver',
      'bronze': 'bronze',
      'custom': 'custom'
    };
    
    const dbPackageType = packageMapping[selectedPackage];
    if (!dbPackageType) {
      return res.status(400).json({
        error: `Invalid sponsorship package type: ${selectedPackage}. Valid options are: Platinum Sponsor, Gold Sponsor, Silver Sponsor, Bronze Sponsor`
      });
    }

    const insertQuery =
      `INSERT INTO sponsorships (
        company_name,
        contact_person,
        email,
        phone,
        website,
        industry,
        special_requirements,
        selected_package,
        company_description,
        message,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', NOW())`;

    const [result] = await pool.query(insertQuery, [
      companyName,
      contactPerson,
      email,
      phone || null,
      website || null,
      industry || null,
      specialRequirements || null,
      dbPackageType,
      `Company: ${companyName}, Contact: ${contactPerson}, Industry: ${industry || 'Not specified'}`,
      specialRequirements || 'No special requirements'
    ]);

    // Form submission record is not needed - data is already in sponsorships table

    // Fetch the inserted row
    const [rows] = await pool.query('SELECT * FROM sponsorships WHERE id = ?', [result.insertId]);

    res.status(201).json({
      message: 'Sponsorship application submitted successfully and is under review',
      sponsorship: rows[0]
    });
  } catch (error) {
    console.error('Error creating sponsorship:', error);
    res.status(500).json({ error: 'Failed to submit sponsorship application' });
  }
});

export default router;

// GET /api/sponsorships - Get all sponsorships
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM sponsorships ORDER BY created_at DESC'
    );
    res.json({
      sponsorships: rows,
      pagination: {
        total: rows.length,
        page: 1,
        limit: 20,
        pages: 1
      }
    });
  } catch (error) {
    console.error('Error fetching sponsorships:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/sponsorships/:id - Delete sponsorship
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if sponsorship exists
    const [rows] = await pool.query('SELECT * FROM sponsorships WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sponsorship not found' });
    }
    
    // Delete from database
    await pool.query('DELETE FROM sponsorships WHERE id = ?', [id]);
    
    res.json({ 
      message: 'Sponsorship deleted successfully',
      deletedId: id 
    });
    
  } catch (error) {
    console.error('Error deleting sponsorship:', error);
    res.status(500).json({ error: 'Failed to delete sponsorship' });
  }
});

// PATCH /api/sponsorships/:id/status - Update sponsorship status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, reviewedBy } = req.body;
    
    // Validate status
    const validStatuses = ['submitted', 'under_review', 'approved', 'rejected', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Check if sponsorship exists
    const [rows] = await pool.query('SELECT * FROM sponsorships WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sponsorship not found' });
    }
    
    // Update sponsorship status
    await pool.query(
      'UPDATE sponsorships SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, adminNotes || null, reviewedBy || null, id]
    );
    
    // Get updated sponsorship
    const [updatedRows] = await pool.query('SELECT * FROM sponsorships WHERE id = ?', [id]);
    
    res.json({
      message: 'Sponsorship status updated successfully',
      sponsorship: updatedRows[0]
    });
    
  } catch (error) {
    console.error('Error updating sponsorship status:', error);
    res.status(500).json({ error: 'Failed to update sponsorship status' });
  }
});

// PUT /api/sponsorships/:id - Update entire sponsorship
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      companyName, 
      contactPerson, 
      email, 
      phone, 
      packageType,
      specialRequirements
    } = req.body;
    
    // Check if sponsorship exists
    const [rows] = await pool.query('SELECT * FROM sponsorships WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sponsorship not found' });
    }
    
    // Update sponsorship
    await pool.query(
      `UPDATE sponsorships SET 
        companyName = ?, 
        contactPerson = ?, 
        email = ?, 
        phone = ?, 
        packageType = ?,
        specialRequirements = ?,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?`,
      [
        companyName,
        contactPerson,
        email,
        phone,
        packageType,
        specialRequirements,
        id
      ]
    );
    
    // Get updated sponsorship
    const [updatedRows] = await pool.query('SELECT * FROM sponsorships WHERE id = ?', [id]);
    
    res.json({
      message: 'Sponsorship updated successfully',
      sponsorship: updatedRows[0]
    });
    
  } catch (error) {
    console.error('Error updating sponsorship:', error);
    res.status(500).json({ error: 'Failed to update sponsorship' });
  }
});
