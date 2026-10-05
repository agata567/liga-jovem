const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração da base de dados com suporte a SSL condicional para produção
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'liga_jovem',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

// Criação do Pool de conexões
const pool = mysql.createPool(dbConfig);

// Garantir que a tabela utilizadores existe ao iniciar o servidor
async function inicializarBanco() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS utilizadores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Base de dados e tabela "utilizadores" ligadas com sucesso!');
  } catch (error) {
    console.error('Erro ao inicializar a base de dados:', error);
  }
}

inicializarBanco();

// Rota inicial de teste
app.get('/', (req, res) => {
  res.send('API a rodar com sucesso!');
});

// Rota para listar todos os utilizadores
app.get('/api/utilizadores', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM utilizadores ORDER BY criado_em DESC');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao procurar utilizadores:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para cadastrar um novo utilizador
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor a rodar na porta ${PORT}`);
});