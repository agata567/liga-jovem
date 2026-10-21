const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend e das imagens
app.use(express.static('public'));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Configuração do Multer para uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const nomeUnico = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const extensao = path.extname(file.originalname).toLowerCase();
    cb(null, nomeUnico + extensao);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Apenas ficheiros de imagem são permitidos!'));
  }
});

// Configuração do Banco de Dados
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'liga_jovem',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Inicialização da Tabela
async function inicializarBanco() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS itens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(150) NOT NULL,
        descricao TEXT,
        status VARCHAR(50) DEFAULT 'disponivel',
        imagem TEXT,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela de itens pronta!');
  } catch (error) {
    console.error('Erro ao inicializar o banco:', error);
  }
}

// ---------------- ROTAS ----------------

// Listar Itens
app.get('/api/itens', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM itens ORDER BY criado_em DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar itens.' });
  }
});

// Cadastrar Item
app.post('/api/itens', upload.single('imagem'), async (req, res) => {
  const { titulo, descricao, status } = req.body;
  if (!titulo || titulo.trim() === '') {
    return res.status(400).json({ error: 'O título do item é obrigatório.' });
  }

  const imagemUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const itemStatus = status || 'disponivel';

  try {
    const [result] = await pool.query(
      'INSERT INTO itens (titulo, descricao, status, imagem) VALUES (?, ?, ?, ?)',
      [titulo, descricao || '', itemStatus, imagemUrl]
    );
    res.status(201).json({ message: 'Item registado com sucesso!', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Erro no banco de dados: ' + error.message });
  }
});

// Alternar Status (Resgatar / Tornar Disponível)
app.patch('/api/itens/:id/status', async (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (isNaN(itemId) || !status) {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE itens SET status = ? WHERE id = ?',
      [status, itemId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }
    res.json({ message: 'Status atualizado com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro no banco de dados: ' + error.message });
  }
});

// Apagar Item
app.delete('/api/itens/:id', async (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  if (isNaN(itemId)) {
    return res.status(400).json({ error: 'ID inválido.' });
  }

  try {
    const [rows] = await pool.query('SELECT imagem FROM itens WHERE id = ?', [itemId]);
    if (rows.length > 0 && rows[0].imagem) {
      const fullPath = path.join(__dirname, rows[0].imagem);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    const [result] = await pool.query('DELETE FROM itens WHERE id = ?', [itemId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    res.json({ message: 'Item eliminado com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro no banco de dados: ' + error.message });
  }
});

const PORT = process.env.PORT || 10000;
inicializarBanco().then(() => {
  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
});