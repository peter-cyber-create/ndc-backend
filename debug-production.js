#!/usr/bin/env node

/**
 * Production Environment Debug Script
 * Run this on the 172.27.0.9 server to diagnose issues
 */

const mysql = require('mysql2/promise');

async function debugProduction() {
  console.log('🔍 Starting Production Environment Debug...');
  console.log('==========================================');

  // 1. Check Environment Variables
  console.log('\n📋 Environment Variables:');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`DB_HOST: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`DB_PORT: ${process.env.DB_PORT || '3306'}`);
  console.log(`DB_USER: ${process.env.DB_USER || 'conf_user'}`);
  console.log(`DB_NAME: ${process.env.DB_NAME || 'conf'}`);
  console.log(`NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL}`);

  // 2. Test Database Connection
  console.log('\n🔗 Testing Database Connection...');
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'conf_user',
      password: process.env.DB_PASSWORD || 'toor',
      database: process.env.DB_NAME || 'conf'
    });
    
    await connection.ping();
    console.log('✅ Database connection successful');
    
    // 3. Check Database Schema
    console.log('\n📊 Checking Database Schema...');
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('Tables found:', tables.map(t => Object.values(t)[0]));
    
    // Check registrations table structure
    const [columns] = await connection.execute('DESCRIBE registrations');
    console.log('\n📋 Registrations table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // Check for missing columns
    const expectedColumns = [
      'payment_status', 'payment_amount', 'payment_currency', 
      'payment_reference', 'is_verified', 'dietary_requirements', 'country'
    ];
    
    const existingColumns = columns.map(col => col.Field);
    const missingColumns = expectedColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('❌ Missing columns in registrations table:');
      missingColumns.forEach(col => console.log(`  - ${col}`));
    } else {
      console.log('✅ All expected columns present');
    }
    
    // 4. Test Insert Operation
    console.log('\n🧪 Testing Insert Operation...');
    const testData = {
      firstName: 'Test',
      lastName: 'User',
      email: `test_${Date.now()}@example.com`,
      phone: '+256700000000',
      organization: 'Test Org',
      position: 'Tester',
      district: 'Kampala',
      country: 'Uganda',
      registrationType: 'local',
      specialRequirements: 'None',
      dietary_requirements: 'None',
      is_verified: false,
      payment_status: 'pending'
    };
    
    const insertQuery = `
      INSERT INTO registrations (
        firstName, lastName, email, phone, organization, position, 
        district, country, registrationType, specialRequirements, 
        dietary_requirements, is_verified, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
      const [result] = await connection.execute(insertQuery, [
        testData.firstName, testData.lastName, testData.email, testData.phone,
        testData.organization, testData.position, testData.district, testData.country,
        testData.registrationType, testData.specialRequirements, testData.dietary_requirements,
        testData.is_verified, testData.payment_status
      ]);
      
      console.log('✅ Test insert successful, ID:', result.insertId);
      
      // Clean up test data
      await connection.execute('DELETE FROM registrations WHERE id = ?', [result.insertId]);
      console.log('✅ Test data cleaned up');
      
    } catch (insertError) {
      console.log('❌ Test insert failed:', insertError.message);
    }
    
    await connection.end();
    
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    console.log('Error details:', error);
  }
  
  // 5. Check File Permissions
  console.log('\n📁 Checking File Permissions...');
  const fs = require('fs');
  const path = require('path');
  
  const checkPaths = [
    './public/uploads/abstracts',
    './.env.production',
    './next.config.js'
  ];
  
  checkPaths.forEach(filePath => {
    try {
      const stats = fs.statSync(filePath);
      console.log(`✅ ${filePath}: exists, permissions: ${stats.mode.toString(8)}`);
    } catch (error) {
      console.log(`❌ ${filePath}: ${error.message}`);
    }
  });
  
  console.log('\n🏁 Debug completed!');
  console.log('==========================================');
}

debugProduction().catch(console.error);
