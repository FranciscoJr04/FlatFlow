const express = require('express');
const mysql = require('mysql2');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsing do JSON
app.use(express.json());

// Conectar ao banco de dados MySQL
const connection = mysql.createConnection({
  host: 'skibidi.mysql.database.azure.com',
  user: 'daniel',
  password: 'F14tomcat',
  database: 'skibidi'
});

connection.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados: ', err);
    return;
  }
  console.log('Conectado ao banco de dados MySQL');
});
app.get('/usuarios', (req, res) => {
    connection.query('SELECT * FROM Usuario', (err, results) => {
        if (err) {
            console.error('Erro ao obter usuários:', err);
            return res.status(500).json({ error: 'Erro ao obter usuários' });
        }

        // Envolvendo a resposta em um objeto JSON estruturado
        res.json({
            totalUsuarios: results.length,
            usuarios: results
        });
    });
});


// Rota para criação do usuário
app.post('/criar_usuario', (req, res) => {
    const { nombre, email, contraseña } = req.body;

    // Verifica se todos os campos necessários foram preenchidos
    if (!nombre || !email || !contraseña) {
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    // Definindo valores padrão
    const PisoCompartido_idPisoCompartido = 1; // Valor padrão
    const Rol_idRol = 2; // Valor padrão

    // Obtemos a quantidade de usuários para definir o próximo id
    connection.query('SELECT COUNT(*) AS count FROM Usuario', (err, results) => {
        if (err) {
            console.error('Erro ao contar usuários:', err);
            return res.status(500).json({ error: 'Erro ao contar usuários' });
        }

        const newId = results[0].count + 1;

        // Inserir o novo usuário no banco de dados
        const query = 'INSERT INTO Usuario (idUsuarios, nombre, email, contraseña, PisoCompartido_idPisoCompartido, Rol_idRol) VALUES (?, ?, ?, ?, ?, ?)';
        connection.query(query, [newId, nombre, email, contraseña, PisoCompartido_idPisoCompartido, Rol_idRol], (err, result) => {
            if (err) {
                console.error('Erro ao inserir usuário:', err);
                return res.status(500).json({ success: false, message: 'Erro ao inserir usuário' });
            }

            // Retorna a resposta com o usuário criado
            res.status(201).json({success: true, message: 'Usuário criado com sucesso'});
        });
    });
});



app.post('/login_usuario', (req, res) => {
    const { email, contraseña } = req.body;

    // Buscar o usuário no banco de dados pelo email
    const query = 'SELECT * FROM Usuario WHERE email = ?';
    connection.query(query, [email], (err, results) => {
        if (err) {
            return res.status(500).send('Erro no servidor');
        }

        if (results.length > 0) {
            const user = results[0];

            // Comparar a senha fornecida com a senha armazenada
            if (user.contraseña === contraseña) {
                return res.status(200).json({success: true, idUsuarios: user.idUsuarios, PisoCompartido_idPisoCompartido: user.PisoCompartido_idPisoCompartido, message: 'Login bem-sucedido'});
            } else {
                return res.status(400).send('Senha incorreta');
            }
        } else {
            return res.status(400).send('Usuário não encontrado');
        }
    });
});

// Rota para criar uma nova república
app.post('/criar_republica', (req, res) => {
    const { codigo, idUsuarios } = req.body;

    // Verifica se os dados obrigatórios foram enviados
    if (!codigo || !idUsuarios) {
        return res.status(400).json({ success: false, message: 'Código e idUsuarios são obrigatórios.' });
    }

    // Obtemos a quantidade de repúblicas para definir o próximo id
    connection.query('SELECT COUNT(*) AS count FROM PisoCompartido', (err, results) => {
        if (err) {
            console.error('Erro ao contar repúblicas:', err);
            return res.status(500).json({ success: false, message: 'Erro ao contar repúblicas' });
        }

        const newIdRepublica = results[0].count + 1;

        // Inserir a nova república no banco de dados
        const query = 'INSERT INTO PisoCompartido (idPisoCompartido, codigo, cantidadMiembros) VALUES (?, ?, ?)';
        connection.query(query, [newIdRepublica, codigo, 1], (err, result) => {
            if (err) {
                console.error('Erro ao criar república:', err);
                return res.status(500).json({ success: false, message: 'Erro ao criar república' });
            }

            // Atualizar o PisoCompartido_idPisoCompartido e o Rol_idRol do usuário
            const updateQuery = 'UPDATE Usuario SET PisoCompartido_idPisoCompartido = ?, Rol_idRol = ? WHERE idUsuarios = ?';
            connection.query(updateQuery, [newIdRepublica, 1, idUsuarios], (err, updateResult) => {
                if (err) {
                    console.error('Erro ao atualizar o PisoCompartido e o Rol do usuário:', err);
                    return res.status(500).json({ success: false, message: 'Erro ao atualizar o PisoCompartido ou o Rol do usuário' });
                }

                // Retorna a resposta com sucesso
                res.status(201).json({
                    success: true,
                    PisoCompartido_idPisoCompartido: newIdRepublica,
                    message: 'República criada com sucesso, PisoCompartido atualizado, e usuário definido como administrador.'
                });
            });
        });
    });
});

// Rota para entrar em uma república
app.post('/entrar_republica', (req, res) => {
    const { codigo, idUsuarios } = req.body;

    // Verifica se os dados obrigatórios foram enviados
    if (!codigo || !idUsuarios) {
        return res.status(400).json({ success: false, message: 'Código e idUsuarios são obrigatórios.' });
    }

    // Verificar se existe uma república com o código fornecido
    const queryRepublica = 'SELECT * FROM PisoCompartido WHERE codigo = ?';
    connection.query(queryRepublica, [codigo], (err, results) => {
        if (err) {
            console.error('Erro ao buscar república:', err);
            return res.status(500).json({ success: false, message: 'Erro ao buscar república' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'República não encontrada' });
        }
        const republica = results[0];
        const republicaId = republica.idPisoCompartido;
        const nuevaCantidadMiembros = republica.cantidadMiembros + 1;
        // Atualizar a quantidade de membros na república
        const queryUpdateRepublica = 'UPDATE PisoCompartido SET cantidadMiembros = ? WHERE idPisoCompartido = ?';
        connection.query(queryUpdateRepublica, [nuevaCantidadMiembros, republicaId], (err, updateResult) => {
            if (err) {
                console.error('Erro ao atualizar cantidadMiembros:', err);
                return res.status(500).json({ success: false, message: 'Erro ao atualizar quantidade de membros da república' });
            }

            // Atualizar o PisoCompartido_idPisoCompartido do usuário
            const queryUpdateUsuario = 'UPDATE Usuario SET PisoCompartido_idPisoCompartido = ? WHERE idUsuarios = ?';
            connection.query(queryUpdateUsuario, [republicaId, idUsuarios], (err, updateUserResult) => {
                if (err) {
                    console.error('Erro ao atualizar PisoCompartido do usuário:', err);
                    return res.status(500).json({ success: false, message: 'Erro ao atualizar PisoCompartido do usuário' });
                }

                // Retornar resposta de sucesso
                res.status(200).json({
                    success: true,
                    PisoCompartido_idPisoCompartido: republicaId,
                    message: 'Usuário entrou na república com sucesso'
                });
            });
        });
    });
});

// Rota para obter os anúncios de uma república
app.get('/get_anuncios', (req, res) => {
    const { PisoCompartido_idPisoCompartido } = req.body;

    // Verifica se o campo PisoCompartido_idPisoCompartido foi enviado
    if (!PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'PisoCompartido_idPisoCompartido é obrigatório.' });
    }

    // Query para obter os anúncios baseados no PisoCompartido_idPisoCompartido
    const query = 'SELECT informaciones FROM MuroAnuncios WHERE PisoCompartido_idPisoCompartido = ?';

    connection.query(query, [PisoCompartido_idPisoCompartido], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Erro ao consultar anúncios.' });
        }

        // Retorna a lista de anúncios com as informacoes
        res.json({ success: true, anuncios: results });
    });
});


// Rota para criar um novo anúncio
app.post('/create_anuncio', (req, res) => {
    const { informaciones, Usuario_idUsuarios, PisoCompartido_idPisoCompartido } = req.body;

    // Verifica se todos os campos obrigatórios foram fornecidos
    if (!informaciones || !Usuario_idUsuarios || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'informaciones, Usuario_idUsuarios e PisoCompartido_idPisoCompartido são obrigatórios.' });
    }

    // Conta quantos anúncios já existem para determinar o próximo idMuro
    const countQuery = 'SELECT COUNT(*) AS count FROM MuroAnuncios';
    connection.query(countQuery, (err, results) => {
        if (err) {
            console.error('Erro ao contar anúncios:', err);
            return res.status(500).json({ success: false, message: 'Erro ao contar anúncios.' });
        }

        const nextIdMuro = results[0].count + 1;

        // Insere o novo anúncio no banco de dados
        const insertQuery = `
            INSERT INTO MuroAnuncios (idMuro, informaciones, Usuario_idUsuarios, PisoCompartido_idPisoCompartido)
            VALUES (?, ?, ?, ?)
        `;
        connection.query(insertQuery, [nextIdMuro, informaciones, Usuario_idUsuarios, PisoCompartido_idPisoCompartido], (err) => {
            if (err) {
                console.error('Erro ao criar anúncio:', err);
                return res.status(500).json({ success: false, message: 'Erro ao criar anúncio.' });
            }

            // Retorna sucesso
            res.status(201).json({
                success: true,
                message: 'Anúncio criado com sucesso.'
            });
        });
    });
});


app.post('/create_bill', (req, res) => {
    const { valor, diaVencimiento, compra, PisoCompartido_idPisoCompartido } = req.body;

    // Verificar se todos os campos necessários foram enviados
    if (!valor || !diaVencimiento || !compra || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }

    // Contar o número de faturas existentes para definir o próximo idCuenta
    connection.query('SELECT COUNT(*) AS count FROM RegistroCuentas', (err, results) => {
        if (err) {
            console.error('Erro ao contar faturas:', err);
            return res.status(500).json({ success: false, message: 'Erro ao contar faturas.' });
        }

        // Define o próximo idCuenta com base na quantidade de faturas
        const IdCuenta = results[0].count + 1;

        // Inserir a fatura no banco de dados
        const query = 'INSERT INTO RegistroCuentas (idCuenta, valor, diaVencimiento, compra, PisoCompartido_idPisoCompartido) VALUES (?, ?, ?, ?, ?)';
        connection.query(query, [IdCuenta, valor, diaVencimiento, compra, PisoCompartido_idPisoCompartido], (err, result) => {
            if (err) {
                console.error('Erro ao criar fatura:', err);
                return res.status(500).json({ success: false, message: 'Erro ao criar fatura.' });
            }

            // Retornar sucesso
            res.status(201).json({
                success: true,
                message: 'Conta criada com sucesso.'
            });
        });
    });
});




// Rota para obter as informações de cobrança (fatura) de um determinado PisoCompartido
app.get('/get_bill', (req, res) => {
    const { PisoCompartido_idPisoCompartido } = req.body;  // ou req.body dependendo de como a requisição é feita

    // Verificar se o campo PisoCompartido_idPisoCompartido está presente
    if (!PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'PisoCompartido_idPisoCompartido é obrigatório.' });
    }

    // Query para buscar a fatura correspondente
    const query = 'SELECT valor, diaVencimiento, compra FROM RegistroCuentas WHERE PisoCompartido_idPisoCompartido = ?';
    connection.query(query, [PisoCompartido_idPisoCompartido], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Erro ao buscar faturas.' });
        }

        // Verificar se existe alguma fatura correspondente
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhuma fatura encontrada.' });
        }

        // Retornar os dados encontrados
        res.json({
            lista_anuncios: results
        });
    });
});

app.delete('/delete_bill', (req, res) => {
    const { compra, PisoCompartido_idPisoCompartido } = req.body;

    if (!compra || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ message: 'Parâmetros incompletos. Informe compra e PisoCompartido_idPisoCompartido.' });
    }

    const query = `
        DELETE FROM RegistroCuentas 
        WHERE compra = ? AND PisoCompartido_idPisoCompartido = ?
    `;

    db.query(query, [compra, PisoCompartido_idPisoCompartido], (err, results) => {
        if (err) {
            console.error('Erro ao deletar conta:', err);
            return res.status(500).json({ message: 'Erro no servidor ao tentar deletar a conta.' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ message: 'Nenhuma conta encontrada para os parâmetros fornecidos.' });
        }

        res.status(200).json({ message: 'Conta deletada com sucesso.' });
    });
});



// Rota para obter o calendário (quehaceres) de um Piso Compartido específico
app.get('/get_calendario', (req, res) => {
    const { PisoCompartido_idPisoCompartido } = req.body; // Obtém o PisoCompartido_idPisoCompartido da query string

    // Verifica se o PisoCompartido_idPisoCompartido foi fornecido
    if (!PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'PisoCompartido_idPisoCompartido é obrigatório.' });
    }

    // Consulta os quehaceres e diaVencimiento associados ao PisoCompartido_idPisoCompartido
    const query = 'SELECT quehacer, diaVencimiento FROM CalendarioQuehaceres WHERE PisoCompartido_idPisoCompartido = ?';
    connection.query(query, [PisoCompartido_idPisoCompartido], (err, results) => {
        if (err) {
            console.error('Erro ao obter o calendário:', err);
            return res.status(500).json({ success: false, message: 'Erro ao obter o calendário.' });
        }

        // Verifica se existem registros para o PisoCompartido_idPisoCompartido fornecido
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum calendário encontrado para o Piso Compartido.' });
        }

        // Retorna os quehaceres e diaVencimiento encontrados
        const calendario = results.map(item => ({
            quehacer: item.quehacer,
            diaVencimiento: item.diaVencimiento
        }));

        res.status(200).json({
            calendario: calendario
        });
    });
});

// Rota para criar um novo "calendario"
app.post('/create_calendario', (req, res) => {
    const { quehacer, diaVencimiento, Usuario_idUsuarios, PisoCompartido_idPisoCompartido } = req.body;

    // Verifica se todos os campos necessários foram fornecidos
    if (!quehacer || !diaVencimiento || !Usuario_idUsuarios || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }

    // Obter a quantidade de registros para determinar o próximo idCalendario
    connection.query('SELECT COUNT(*) AS count FROM CalendarioQuehaceres', (err, results) => {
        if (err) {
            console.error('Erro ao contar os registros do calendário:', err);
            return res.status(500).json({ success: false, message: 'Erro ao contar os registros do calendário.' });
        }

        const newIdCalendario = results[0].count + 1;

        // Inserir um novo registro na tabela calendario_quehaceres
        const query = `
            INSERT INTO CalendarioQuehaceres (idCalendario, quehacer, diaVencimiento, Usuario_idUsuarios, PisoCompartido_idPisoCompartido) 
            VALUES (?, ?, ?, ?, ?)
        `;
        
        connection.query(query, [newIdCalendario, quehacer, diaVencimiento, Usuario_idUsuarios, PisoCompartido_idPisoCompartido], (err, result) => {
            if (err) {
                console.error('Erro ao inserir o novo calendário:', err);
                return res.status(500).json({ success: false, message: 'Erro ao criar o calendário.' });
            }

            // Retorna sucesso
            res.status(201).json({
                success: true,
                message: 'Calendário criado com sucesso'
            });
        });
    });
});



app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
