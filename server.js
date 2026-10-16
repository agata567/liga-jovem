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
        imagem TEXT,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Garante que a coluna 'titulo' existe caso a tabela tenha sido criada sem ela
    try {
      await pool.query(`ALTER TABLE itens ADD COLUMN titulo VARCHAR(150) NOT NULL;`);
    } catch (err) {
      // Ignora erro se a coluna já existir
    }

    // Garante que a coluna 'imagem' seja TEXT
    try {
      await pool.query(`ALTER TABLE itens MODIFY COLUMN imagem TEXT;`);
    } catch (err) {
      // Ignora erro caso não seja necessário alterar
    }

    console.log('Base de dados e tabelas inicializadas com sucesso!');
  } catch (error) {
    console.error('Erro ao inicializar a base de dados:', error);
  }
}