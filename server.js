const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // 1. Importar o multer para upload de ficheiros
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Força o caminho absoluto para evitar erros de diretório no terminal
const pastaProjeto = path.resolve(__dirname);

// Servir ficheiros estáticos (HTML, CSS, JS) e abrir a pasta pública de uploads de fotos
app.use(express.static(pastaProjeto));
app.use('/uploads', express.static(path.join(pastaProjeto, 'uploads')));

// Garantir que a pasta 'uploads' existe localmente para não quebrar o upload
if (!fs.existsSync(path.join(pastaProjeto, 'uploads'))) {
    fs.mkdirSync(path.join(pastaProjeto, 'uploads'));
}

// Configuração de Armazenamento do Multer em disco
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(pastaProjeto, 'uploads/'));
    },
    filename: (req, file, cb) => {
        // Gera um nome único juntando o timestamp atual e a extensão do ficheiro original
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtro de segurança para aceitar estritamente ficheiros de imagem
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Apenas são permitidas imagens!'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// 2. Rota principal inteligente com diagnóstico de erros automático
app.get('/', (req, res) => {
    const caminhoIndex = path.join(pastaProjeto, 'index.html');
    const caminhoItens = path.join(pastaProjeto, 'itens.html');

    // 1º Tenta servir o index.html unificado
    if (fs.existsSync(caminhoIndex)) {
        return res.sendFile(caminhoIndex);
    } 
    // 2º Se não existir o index, tenta servir o itens.html original
    else if (fs.existsSync(caminhoItens)) {
        return res.sendFile(caminhoItens);
    } 
    // 3º Se nenhum existir, mostra um diagnóstico claro no navegador em vez de "Cannot GET /"
    else {
        res.status(404).send(`
            <div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6;">
                <h2 style="color: #d9534f;">❌ Erro: Nenhum ficheiro HTML principal foi encontrado!</h2>
                <p>O Express tentou procurar nas seguintes localizações:</p>
                <ul>
                    <li><code>${caminhoIndex}</code> (Não encontrado)</li>
                    <li><code>${caminhoItens}</code> (Não encontrado)</li>
                </ul>
                <p><strong>Diretório atual do servidor:</strong> <code>${pastaProjeto}</code></p>
                <p><strong>Como resolver:</strong> Certifique-se de que o seu ficheiro HTML unificado está guardado nesta pasta com o nome exato de <code>index.html</code> ou <code>itens.html</code>.</p>
            </div>
        `);
    }
});

// Configuração da conexão com o MySQL
const db = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root', // A tua palavra-passe confirmada
    database: 'banco_escola',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('Erro ao conectar ao MySQL:', err.message);
    } else {
        console.log('Conectado com sucesso ao MySQL!');
        connection.release();
    }
});

// ROTAS DA API

// Listar todos os itens
app.get('/api/itens', (req, res) => {
    const query = `SELECT * FROM itens ORDER BY criado_em DESC`;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Criar item integrado com upload de imagem (usando upload.single)
app.post('/api/itens', upload.single('imagem'), (req, res) => {
    const { nome, categoria, local_encontrado, descricao } = req.body;
    
    // Se o utilizador enviou um ficheiro, guarda o caminho relativo. Caso contrário, envia null.
    const imagem_url = req.file ? `/uploads/${req.file.filename}` : null;

    const query = `INSERT INTO itens (nome, categoria, local_encontrado, descricao, imagem_url) VALUES (?, ?, ?, ?, ?)`;

    db.query(query, [nome, categoria, local_encontrado, descricao, imagem_url], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Item registado com sucesso!', id: result.insertId });
    });
});

// Atualizar item (Status e local de recolha)
app.put('/api/itens/:id', (req, res) => {
    const { id } = req.params;
    const { status, local_recolha } = req.body;

    const query = `UPDATE itens SET status = ?, local_recolha = ? WHERE id = ?`;

    db.query(query, [status, local_recolha, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Item não encontrado.' });
        res.json({ message: 'Item updated com sucesso!' });
    });
});

// Eliminar item (E apagar automaticamente o ficheiro físico da imagem na pasta uploads)
app.delete('/api/itens/:id', (req, res) => {
    const { id } = req.params;

    // Procura o caminho da foto antes de deletar o registo do banco
    db.query('SELECT imagem_url FROM itens WHERE id = ?', [id], (err, results) => {
        if (!err && results.length > 0 && results[0].imagem_url) {
            const filePath = path.join(pastaProjeto, results[0].imagem_url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath); // Elimina a foto antiga do servidor local
            }
        }

        const query = `DELETE FROM itens WHERE id = ?`;
        db.query(query, [id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Item não encontrado.' });
            res.json({ message: 'Item eliminado com sucesso!' });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
});
