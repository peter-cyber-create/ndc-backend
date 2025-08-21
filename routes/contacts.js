import express from 'express';
import { pool } from '../config/db.js';
import { validateContact } from '../middleware/validation.js';
import { sendContactConfirmation, sendAdminNotification, sendResponseEmail } from '../middleware/emailService.js';
import { 
    successResponse, 
    errorResponse, 
    bulkOperationResponse,
    emailNotificationResponse
} from '../middleware/responseFormatter.js';

const router = express.Router();

// GET /api/contacts - Get all contacts
router.get('/', async (req, res) => {
    try {
        console.log('Fetching contacts...');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        // Get contacts with pagination
        const contactsQuery = `
            SELECT 
                id,
                name,
                email,
                phone,
                organization,
                subject,
                message,
                status,
                created_at as submitted_at,
                updated_at as responded_at
            FROM contacts 
            ORDER BY created_at DESC 
            LIMIT $1 OFFSET $2
        `;
        
        const [contactsRows] = await pool.query(contactsQuery, [limit, offset]);
        // Get total count
        const [countRows] = await pool.query('SELECT COUNT(*) as count FROM contacts');
        const total = parseInt(countRows[0].count);
        // Get stats
        const statsQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'responded' THEN 1 END) as responded,
                COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as this_week
            FROM contacts
        `;
        const [statsRows] = await pool.query(statsQuery);
        const stats = statsRows[0];
        res.json({
            contacts: contactsRows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            stats: {
                total: parseInt(stats.total),
                pending: parseInt(stats.pending),
                responded: parseInt(stats.responded),
                thisWeek: parseInt(stats.this_week)
            }
        });
        
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/contacts - Create new contact
router.post('/', validateContact, async (req, res) => {
    try {
        console.log('Creating new contact:', req.body);
        const { name, email, phone, organization, subject, message } = req.body;
        const query = `
            INSERT INTO contacts (name, email, phone, organization, subject, message, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())
        `;
        const values = [name, email, phone || null, organization || null, subject, message];
        const [result] = await pool.query(query, values);
        // Fetch the inserted row
        const [rows] = await pool.query('SELECT * FROM contacts WHERE id = ?', [result.insertId]);
        const newContact = rows[0];
        // Send email notifications asynchronously (don't wait for them)
        setImmediate(async () => {
            try {
                await sendContactConfirmation(newContact);
                await sendAdminNotification(newContact);
            } catch (emailError) {
                console.error('Email notification error:', emailError);
            }
        });
        return successResponse(res, {
            contact: newContact,
            info: 'Confirmation email will be sent shortly'
        }, 'Contact message submitted successfully', 201);
    } catch (error) {
        console.error('Error creating contact:', error);
        return errorResponse(res, 'Failed to submit contact message', 500);
    }
});

// GET /api/contacts/:id - Get specific contact
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT 
                id,
                name,
                email,
                phone,
                organization,
                subject,
                message,
                status,
                created_at as submitted_at,
                updated_at as responded_at
            FROM contacts 
            WHERE id = $1
        `;
        
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return errorResponse(res, 'Contact not found', 404);
        }
        
        return successResponse(res, result.rows[0], 'Contact retrieved successfully');
        
    } catch (error) {
        console.error('Error fetching contact:', error);
        res.status(500).json({
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

// PUT /api/contacts/:id - Update contact status
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, response_message } = req.body;
        
        // First get the current contact data
        const currentContactQuery = `
            SELECT * FROM contacts WHERE id = $1
        `;
        const currentResult = await pool.query(currentContactQuery, [id]);
        
        if (currentResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Contact not found',
                timestamp: new Date().toISOString()
            });
        }
        
        const currentContact = currentResult.rows[0];
        
        // Update the contact
        const query = `
            UPDATE contacts 
            SET status = $1, response_message = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `;
        
        const result = await pool.query(query, [status, response_message || null, id]);
        const updatedContact = result.rows[0];
        
        // If status changed to 'responded' and there's a response message, send email
        if (status === 'responded' && response_message && currentContact.status !== 'responded') {
            setImmediate(async () => {
                try {
                    await sendResponseEmail(updatedContact, response_message);
                } catch (emailError) {
                    console.error('Failed to send response email:', emailError);
                }
            });
        }
        
        res.json({
            message: 'Contact updated successfully',
            contact: updatedContact,
            timestamp: new Date().toISOString(),
            info: status === 'responded' && response_message ? 'Response email will be sent to the contact' : undefined
        });
        
    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

// DELETE /api/contacts/:id - Delete contact
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query('DELETE FROM contacts WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Contact not found',
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            message: 'Contact deleted successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

// BULK ACTIONS - Update multiple contacts status
router.patch('/bulk/status', async (req, res) => {
    try {
        const { ids, status, response_message } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ 
                error: 'IDs array is required',
                timestamp: new Date().toISOString()
            });
        }

        if (!['pending', 'responded', 'closed'].includes(status)) {
            return res.status(400).json({ 
                error: 'Invalid status. Must be pending, responded, or closed',
                timestamp: new Date().toISOString()
            });
        }

        const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
        const params = [...ids, status, response_message || null];

        const result = await pool.query(
            `UPDATE contacts SET 
                status = $${ids.length + 1}, 
                response_message = $${ids.length + 2}, 
                updated_at = NOW()
            WHERE id IN (${placeholders}) RETURNING *`,
            params
        );

        return bulkOperationResponse(res, 'updated', result.rows, ids.length);

    } catch (error) {
        console.error('Error bulk updating contacts:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
});

// BULK ACTIONS - Delete multiple contacts
router.delete('/bulk', async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ 
                error: 'IDs array is required',
                timestamp: new Date().toISOString()
            });
        }

        const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
        
        const result = await pool.query(
            `DELETE FROM contacts WHERE id IN (${placeholders}) RETURNING *`,
            ids
        );

        res.json({
            message: `${result.rows.length} contacts deleted successfully`,
            deleted: result.rows,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error bulk deleting contacts:', error);
        res.status(500).json({
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

export default router;
