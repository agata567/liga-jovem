const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Conexão com o banco de dados
const db = new sqlite3.Database('./banco_escola.db', (err) => {
    if (err) console.error("Erro ao conectar no BD:", err.message);
    else console.log("Conectado ao banco de dados SQLite.");
});

// Criar tabela automaticamente se não existir
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        descricao TEXT,
        categoria TEXT NOT NULL,
        local_encontrado TEXT NOT NULL,
        status TEXT DEFAULT 'perdido'
    )`);
});

// Rota para listar itens
app.get('/api/itens', (req, res) => {
    db.all("SELECT * FROM itens ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Rota para cadastrar item
app.post('/api/itens', (req, res) => {
    const { titulo, descricao, categoria, local_encontrado } = req.body;
    const sql = `INSERT INTO itens (titulo, descricao, categoria, local_encontrado) VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [titulo, descricao, categoria, local_encontrado], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.status(201).json({ id: this.lastID, mensagem: "Item cadastrado com sucesso!" });
    });
});

app.listen(3000, () => {
    console.log("Servidor Back-End rodando em http://localhost:3000");
});