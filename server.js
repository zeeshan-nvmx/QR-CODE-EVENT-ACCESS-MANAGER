const express = require('express')
require('dotenv').config();
const mongoose = require('mongoose')
const QRCode = require('qrcode')
const cors = require('cors')
const fs = require('fs').promises
const path = require('path')
const XLSX = require('xlsx')


const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect(process.env.MONGODB_URI)

const QRCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  codeNumber: { type: Number, unique: true },
  used: { type: Boolean, default: false },
  usedAt: Date,
})

const QRCodeModel = mongoose.model('QRCode', QRCodeSchema)

// Generate QR codes
// app.post('/api/generate-codes', async (req, res) => {
//   try {
//     const { amount } = req.body
//     const codes = []
//     const outputDir = path.join(__dirname, 'qrcodes')

//     // Create output directory if it doesn't exist
//     await fs.mkdir(outputDir, { recursive: true })

//     // Get the current highest code number
//     const lastCode = await QRCodeModel.findOne().sort('-codeNumber')
//     let startNumber = lastCode ? lastCode.codeNumber + 1 : 1

//     for (let i = 0; i < amount; i++) {
//       const code = `EVENT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
//       const codeNumber = startNumber + i

//       // Generate QR code image
//       await QRCode.toFile(path.join(outputDir, `qr-${codeNumber}.png`), code, { width: 300 })

//       codes.push({ code, codeNumber })
//     }

//     // Insert all codes into database
//     await QRCodeModel.insertMany(codes)

//     res.json({ success: true, message: `Generated ${amount} QR codes` })
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message })
//   }
// })

// Scan QR code
app.post('/api/scan', async (req, res) => {
  try {
    const { qrCode } = req.body
    const code = await QRCodeModel.findOne({ code: qrCode })

    if (!code) {
      return res.json({ success: false, message: 'Invalid QR code' })
    }

    if (code.used) {
      return res.json({ success: false, message: 'QR code already used' })
    }

    code.used = true
    code.usedAt = new Date()
    await code.save()

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Reset QR code
app.post('/api/reset-code/:codeNumber', async (req, res) => {
  try {
    const code = await QRCodeModel.findOne({ codeNumber: req.params.codeNumber })

    if (!code) {
      return res.status(404).json({ success: false, message: 'Code not found' })
    }

    code.used = false
    code.usedAt = null
    await code.save()

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/export-excel', async (req, res) => {
  try {
    const codes = await QRCodeModel.find({})

    const data = codes.map((code) => ({
      'Code Number': code.codeNumber,
      'QR Code': code.code,
      Used: code.used ? 'Yes' : 'No',
      'Used At': code.usedAt ? code.usedAt.toLocaleString() : '',
    }))

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'QR Codes')

    const fileName = `qr-codes-${Date.now()}.xlsx`
    const filePath = path.join(__dirname, fileName)

    // Save to disk
    XLSX.writeFile(workbook, filePath)

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`)
    res.sendFile(filePath)
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
