require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Garante a existência da pasta de uploads
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuração do Multer para armazenamento de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Configuração da base de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'liga_jovem',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = mysql.createPool(dbConfig);

// Inicialização das tabelas na base de dados
async function inicializarBanco() {
  try {
    // Tabela de utilizadores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS utilizadores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabela de itens
    await pool.query(`
      CREATE TABLE IF NOT EXISTS itens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(150) NOT NULL,
        descricao TEXT,
        status VARCHAR(50) DEFAULT 'disponivel',
        imagem VARCHAR(255),
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Base de dados e tabelas inicializadas com sucesso!');
  } catch (error) {
    console.error('Erro ao inicializar a base de dados:', error);
  }
}

// Rota inicial de verificação
app.get('/', (req, res) => {
  res.send('API Liga Jovem a rodar com sucesso!');
});

/* ==========================================================================
   ROTAS DE UTILIZADORES
   ========================================================================== */

app.get('/api/utilizadores', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM utilizadores ORDER BY criado_em DESC');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao procurar utilizadores:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/utilizadores', async (req, res) => {
  const { nome, email } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO utilizadores (nome, email) VALUES (?, ?)',
      [nome, email]
    );
    res.status(201).json({ message: 'Utilizador registado com sucesso!', id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Este e-mail já está registado.' });
    }
    console.error('Erro ao inserir utilizador:', error);
    res.status(500).json({ error: 'Erro ao guardar na base de dados' });
  }
});

/* ==========================================================================
   ROTAS DE ITENS
   ========================================================================== */

app.get('/api/itens', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM itens ORDER BY criado_em DESC');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao procurar itens:', error);
    res.status(500).json({ error: 'Erro ao procurar itens no servidor' });
  }
});

app.post('/api/itens', upload.single('imagem'), async (req, res) => {
  const { titulo, descricao, status } = req.body;

  if (!titulo) {
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
    console.error('Erro ao inserir item:', error);
    res.status(500).json({ error: 'Erro ao guardar o item no banco de dados' });
  }
});

const PORT = process.env.PORT || 3001;

inicializarBanco().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor a rodar na porta ${PORT}`);
  });
});