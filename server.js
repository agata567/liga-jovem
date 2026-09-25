const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração da conexão com o MySQL
const db = mysql.createPool({
    host: 'localhost',      // Endereço do servidor MySQL
    port: 3306,             // Porta padrão do MySQL Workbench
    user: 'root',           // O teu utilizador do MySQL
    password: '', // <--- MUDAR AQUI: Coloca a tua palavra-passe do MySQL Workbench
    database: 'banco_escola',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Testar conexão
db.getConnection((err, connection) => {
    if (err) {
        console.error('Erro ao conectar ao MySQL:', err.message);
    } else {
        console.log('Conectado com sucesso ao MySQL!');
        connection.release();
    }
});

// Rota 1: Cadastrar novo item
app.post('/api/itens', (req, res) => {
    const { nome, categoria, local_encontrado, descricao } = req.body;
    const query = `INSERT INTO itens (nome, categoria, local_encontrado, descricao) VALUES (?, ?, ?, ?)`;

    db.query(query, [nome, categoria, local_encontrado, descricao], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Item registado com sucesso!', id: result.insertId });
    });
});

// Rota 2: Listar todos os itens
app.get('/api/itens', (req, res) => {
    const query = `SELECT * FROM itens ORDER BY criado_em DESC`;

    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Rota 3: Atualizar estado do item (Dono encontrou / Local de recolha)
app.put('/api/itens/:id', (req, res) => {
    const { id } = req.params;
    const { status, local_recolha } = req.body;

    const query = `UPDATE itens SET status = ?, local_recolha = ? WHERE id = ?`;

    db.query(query, [status, local_recolha, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Item não encontrado.' });
        }
        res.json({ message: 'Item atualizado com sucesso!' });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
});