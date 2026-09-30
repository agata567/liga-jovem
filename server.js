const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração da base de dados com suporte a variáveis do Render e Aiven
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'banco_escola',
    ssl: process.env.DB_HOST ? { minVersion: 'TLSv1.2', rejectUnauthorized: false } : false
};

// Criação do Pool de conexões
const pool = mysql.createPool(dbConfig);

// Função para garantir que a tabela existe ao iniciar a API na nuvem
async function inicializarBanco() {
    try {
        const connection = await pool.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS itens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                categoria VARCHAR(100) NOT NULL,
                local_encontrado VARCHAR(255) NOT NULL,
                descricao TEXT,
                status VARCHAR(50) DEFAULT 'disponivel',
                local_recolha VARCHAR(255) DEFAULT NULL,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Tabela "itens" verificada/criada com sucesso no Aiven!');
        connection.release();
    } catch (error) {
        console.error('Erro ao inicializar a base de dados:', error);
    }
}

inicializarBanco();

// Rota inicial de teste
app.get('/', (req, res) => {
    res.send('API do Achados e Perdidos a rodar com sucesso na nuvem!');
});

// Rota para listar todos os itens
app.get('/api/itens', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM itens ORDER BY criado_em DESC');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao procurar itens:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para cadastrar um novo item
app.post('/api/itens', async (req, res) => {
    const { nome, categoria, local_encontrado, descricao, local_recolha } = req.body;
    
    if (!nome || !categoria || !local_encontrado) {
        return res.status(400).json({ error: 'Campos obrigatórios em falta.' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO itens (nome, categoria, local_encontrado, descricao, local_recolha) VALUES (?, ?, ?, ?, ?)',
            [nome, categoria, local_encontrado, descricao || null, local_recolha || null]
        );
        res.status(201).json({ message: 'Item registado com sucesso!', id: result.insertId });
    } catch (error) {
        console.error('Erro ao inserir item:', error);
        res.status(500).json({ error: 'Erro ao guardar na base de dados' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor a rodar na porta ${PORT}`);
});