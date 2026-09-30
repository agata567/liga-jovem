const mysql = require('mysql2/promise');

async function criarTabelaNuvem() {
    try {
        const connection = await mysql.createConnection({
            host: 'mysql-12f93e75-escola-c877.h.aivencloud.com',
            port: 23292,
            user: 'avnadmin',
            password: 'TUA_PASSWORD_DO_AIVEN',
            database: 'defaultdb',
            ssl: {
                rejectUnauthorized: false
            }
        });

        console.log('Conectado ao Aiven com sucesso!');

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

        console.log('Tabela "itens" criada com sucesso na nuvem!');
        await connection.end();
    } catch (error) {
        console.error('Erro ao conectar ou criar tabela:', error);
    }
}

criarTabelaNuvem();