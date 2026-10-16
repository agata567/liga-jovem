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

// Garante a existência da pasta de uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Servir ficheiros estáticos da pasta uploads
app.use('/uploads', express.static(uploadDir));

// Configuração do Multer com nomes únicos para ficheiros
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const nomeUnico = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const extensao = path.extname(file.originalname).toLowerCase();
    cb(null, nomeUnico + extensao);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Apenas ficheiros de imagem são permitidos!'));
  }
});

// Configuração da base de dados MySQL (lê do ambiente do Render)
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

// Inicialização automática das tabelas com verificação de colunas
async function inicializarBanco() {
  try {
    // 1. Tabela de utilizadores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS utilizadores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Apaga a tabela antiga caso esteja sem a coluna 'titulo'
    try {
      const [columns] = await pool.query(`SHOW COLUMNS FROM itens LIKE 'titulo';`);
      if (columns.length === 0) {
        console.log('Tabela itens desatualizada detectada. A recriar...');
        await pool.query(`DROP TABLE IF EXISTS itens;`);
      }
    } catch (e) {
      // Tabela ainda não existe
    }

    // 3. Cria a tabela de itens atualizada
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

    console.log('Base de dados e tabelas sincronizadas com sucesso!');
  } catch (error) {
    console.error('Erro ao inicializar a base de dados:', error);
  }
}

// Rota de status/teste
app.get('/', (req, res) => {
  res.send('API Liga Jovem a rodar com sucesso no Render!');
});

/* ==========================================================================
   ROTAS DE UTILIZADORES
   ========================================================================== */

// Listar Utilizadores
app.get('/api/utilizadores', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM utilizadores ORDER BY criado_em DESC');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao procurar utilizadores:', error);
    res.status(500).json({ error: 'Erro ao carregar lista de utilizadores.' });
  }
});

// Cadastrar Utilizador
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
    res.status(500).json({ error: 'Erro no banco de dados: ' + error.message });
  }
});

// Eliminar Utilizador
app.delete('/api/utilizadores/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'ID de utilizador inválido.' });
  }

  try {
    const [result] = await pool.query('DELETE FROM utilizadores WHERE id = ?', [userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Utilizador não encontrado para exclusão.' });
    }

    res.json({ message: 'Utilizador eliminado com sucesso!' });
  } catch (error) {
    console.error('Erro ao eliminar utilizador:', error);
    res.status(500).json({ error: 'Erro no banco de dados: ' + error.message });
  }
});

/* ==========================================================================
   ROTAS DE ITENS
   ========================================================================== */

// Listar Itens
app.get('/api/itens', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM itens ORDER BY criado_em DESC');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao procurar itens:', error);
    res.status(500).json({ error: 'Erro ao procurar itens no servidor.' });
  }
});

// Cadastrar Item (com Upload de Imagem)
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
    console.error('Erro detalhado do MySQL ao inserir item:', error);
    res.status(500).json({ error: 'Erro no banco de dados: ' + error.message });
  }
});

// Eliminar Item
app.delete('/api/itens/:id', async (req, res) => {
  const itemId = parseInt(req.params.id, 10);

  if (isNaN(itemId)) {
    return res.status(400).json({ error: 'ID de item inválido.' });
  }

  try {
    const [rows] = await pool.query('SELECT imagem FROM itens WHERE id = ?', [itemId]);
    if (rows.length > 0 && rows[0].imagem) {
      const fullPath = path.join(__dirname, rows[0].imagem);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    const [result] = await pool.query('DELETE FROM itens WHERE id = ?', [itemId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item não encontrado para exclusão.' });
    }

    res.json({ message: 'Item eliminado com sucesso!' });
  } catch (error) {
    console.error('Erro ao eliminar item:', error);
    res.status(500).json({ error: 'Erro no banco de dados: ' + error.message });
  }
});

// Porta do servidor
const PORT = process.env.PORT || 10000;

inicializarBanco().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor a rodar na porta ${PORT}`);
  });
});