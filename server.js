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


app.post('/criar_usuario', (req, res) => {
    const { nombre, email, contraseña } = req.body;
    if (!nombre || !email || !contraseña) {
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    const PisoCompartido_idPisoCompartido = 1; // Valor padrão
    const Rol_idRol = 2; // Valor padrão
    connection.query('SELECT MAX(idUsuarios) AS maxId FROM Usuario', (err, results) => {
        if (err) {
            console.error('Erro ao buscar o último idUsuarios:', err);
            return res.status(500).json({ error: 'Erro ao buscar o último idUsuarios' });
        }
        const newId = results[0].maxId ? results[0].maxId + 1 : 1; // Caso não haja usuários, começa com id 1
        const query = 'INSERT INTO Usuario (idUsuarios, nombre, email, contraseña, PisoCompartido_idPisoCompartido, Rol_idRol) VALUES (?, ?, ?, ?, ?, ?)';
        connection.query(query, [newId, nombre, email, contraseña, PisoCompartido_idPisoCompartido, Rol_idRol], (err, result) => {
            if (err) {
                console.error('Erro ao inserir usuário:', err);
                return res.status(500).json({ success: false, message: 'Erro ao inserir usuário' });
            }
            res.status(201).json({success: true, message: 'Usuário criado com sucesso'});
        });
    });
});




app.post('/login_usuario', (req, res) => {
    const { email, contraseña } = req.body;
    const query = 'SELECT * FROM Usuario WHERE email = ?';
    connection.query(query, [email], (err, results) => {
        if (err) {
            return res.status(500).send('Erro no servidor');
        }

        if (results.length > 0) {
            const user = results[0];
            if (user.contraseña === contraseña) {
                // Consulta para obter o código da república usando o PisoCompartido_idPisoCompartido
                const queryCodigoRepublica = 'SELECT codigo FROM PisoCompartido WHERE idPisoCompartido = ?';
                connection.query(queryCodigoRepublica, [user.PisoCompartido_idPisoCompartido], (err, resultsCodigo) => {
                    if (err) {
                        return res.status(500).send('Erro ao obter código da república');
                    }

                    if (resultsCodigo.length > 0) {
                        const codigoRepublica = resultsCodigo[0].codigo;

                        return res.status(200).json({
                            success: true,
                            idUsuarios: user.idUsuarios,
                            PisoCompartido_idPisoCompartido: user.PisoCompartido_idPisoCompartido,
                            codigo: codigoRepublica,  // Envia o código da república
                            message: 'Login bem-sucedido'
                        });
                    } else {
                        return res.status(400).send('República não encontrada');
                    }
                });
            } else {
                return res.status(400).send('Senha incorreta');
            }
        } else {
            return res.status(400).send('Usuário não encontrado');
        }
    });
});


app.post('/criar_republica', (req, res) => {
    const { codigo, idUsuarios } = req.body;
    if (!codigo || !idUsuarios) {
        return res.status(400).json({ success: false, message: 'Código e idUsuarios são obrigatórios.' });
    }
    connection.query('SELECT COUNT(*) AS count FROM PisoCompartido', (err, results) => {
        if (err) {
            console.error('Erro ao contar repúblicas:', err);
            return res.status(500).json({ success: false, message: 'Erro ao contar repúblicas' });
        }

        const newIdRepublica = results[0].count + 1;
        const query = 'INSERT INTO PisoCompartido (idPisoCompartido, codigo, cantidadMiembros) VALUES (?, ?, ?)';
        connection.query(query, [newIdRepublica, codigo, 1], (err, result) => {
            if (err) {
                console.error('Erro ao criar república:', err);
                return res.status(500).json({ success: false, message: 'Erro ao criar república' });
            }
            const updateQuery = 'UPDATE Usuario SET PisoCompartido_idPisoCompartido = ?, Rol_idRol = ? WHERE idUsuarios = ?';
            connection.query(updateQuery, [newIdRepublica, 1, idUsuarios], (err, updateResult) => {
                if (err) {
                    console.error('Erro ao atualizar o PisoCompartido e o Rol do usuário:', err);
                    return res.status(500).json({ success: false, message: 'Erro ao atualizar o PisoCompartido ou o Rol do usuário' });
                }
                res.status(201).json({
                    success: true,
                    PisoCompartido_idPisoCompartido: newIdRepublica,
                    message: 'República criada com sucesso, PisoCompartido atualizado, e usuário definido como administrador.'
                });
            });
        });
    });
});

app.post('/entrar_republica', (req, res) => {
    const { codigo, idUsuarios } = req.body;
    if (!codigo || !idUsuarios) {
        return res.status(400).json({ success: false, message: 'Código e idUsuarios são obrigatórios.' });
    }
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
        const queryUpdateRepublica = 'UPDATE PisoCompartido SET cantidadMiembros = ? WHERE idPisoCompartido = ?';
        connection.query(queryUpdateRepublica, [nuevaCantidadMiembros, republicaId], (err, updateResult) => {
            if (err) {
                console.error('Erro ao atualizar cantidadMiembros:', err);
                return res.status(500).json({ success: false, message: 'Erro ao atualizar quantidade de membros da república' });
            }
            const queryUpdateUsuario = 'UPDATE Usuario SET PisoCompartido_idPisoCompartido = ? WHERE idUsuarios = ?';
            connection.query(queryUpdateUsuario, [republicaId, idUsuarios], (err, updateUserResult) => {
                if (err) {
                    console.error('Erro ao atualizar PisoCompartido do usuário:', err);
                    return res.status(500).json({ success: false, message: 'Erro ao atualizar PisoCompartido do usuário' });
                }
                res.status(200).json({
                    success: true,
                    PisoCompartido_idPisoCompartido: republicaId,
                    message: 'Usuário entrou na república com sucesso'
                });
            });
        });
    });
});

app.get('/getBulletinCard', (req, res) => {
    const { PisoCompartido_idPisoCompartido } = req.query; // Obtém o PisoCompartido_idPisoCompartido da query string

    // Verifica se o PisoCompartido_idPisoCompartido foi fornecido
    if (!PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'PisoCompartido_idPisoCompartido é obrigatório.' });
    }

    // Consulta os dados do boletim
    const query = 'SELECT informaciones FROM MuroAnuncios WHERE PisoCompartido_idPisoCompartido = ?';
    connection.query(query, [PisoCompartido_idPisoCompartido], (err, results) => {
        if (err) {
            console.error('Erro ao obter boletins:', err);
            return res.status(500).json({ success: false, message: 'Erro ao obter boletins.' });
        }

        // Verifica se existem registros para o PisoCompartido_idPisoCompartido fornecido
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum boletim encontrado para o Piso Compartido.' });
        }

        // Retorna os resultados diretamente como um array
        const boletins = results.map(item => ({
            informaciones: item.informaciones
        }));

        // Retorna o array de boletins diretamente
        res.status(200).json(boletins);
    });
});


app.post('/createBulletinCard', (req, res) => {
    const { informaciones, Usuario_idUsuarios, PisoCompartido_idPisoCompartido } = req.body;
    if (!informaciones || !Usuario_idUsuarios || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'informaciones, Usuario_idUsuarios e PisoCompartido_idPisoCompartido são obrigatórios.' });
    }
    const countQuery = 'SELECT COUNT(*) AS count FROM MuroAnuncios';
    connection.query(countQuery, (err, results) => {
        if (err) {
            console.error('Erro ao contar anúncios:', err);
            return res.status(500).json({ success: false, message: 'Erro ao contar anúncios.' });
        }
        const nextIdMuro = results[0].count + 1;
        const insertQuery = `
            INSERT INTO MuroAnuncios (idMuro, informaciones, Usuario_idUsuarios, PisoCompartido_idPisoCompartido)
            VALUES (?, ?, ?, ?)
        `;
        connection.query(insertQuery, [nextIdMuro, informaciones, Usuario_idUsuarios, PisoCompartido_idPisoCompartido], (err) => {
            if (err) {
                console.error('Erro ao criar anúncio:', err);
                return res.status(500).json({ success: false, message: 'Erro ao criar anúncio.' });
            }
            res.status(201).json({
                success: true,
                message: 'Anúncio criado com sucesso.'
            });
        });
    });
});


app.post('/createBillCard', (req, res) => {
    const { valor, diaVencimiento, compra, PisoCompartido_idPisoCompartido } = req.body;
    if (!valor || !diaVencimiento || !compra || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }
    connection.query('SELECT COUNT(*) AS count FROM RegistroCuentas', (err, results) => {
        if (err) {
            console.error('Erro ao contar faturas:', err);
            return res.status(500).json({ success: false, message: 'Erro ao contar faturas.' });
        }
        const IdCuenta = results[0].count + 1;
        const query = 'INSERT INTO RegistroCuentas (idCuenta, valor, diaVencimiento, compra, PisoCompartido_idPisoCompartido) VALUES (?, ?, ?, ?, ?)';
        connection.query(query, [IdCuenta, valor, diaVencimiento, compra, PisoCompartido_idPisoCompartido], (err, result) => {
            if (err) {
                console.error('Erro ao criar fatura:', err);
                return res.status(500).json({ success: false, message: 'Erro ao criar fatura.' });
            }
            res.status(201).json({
                success: true,
                message: 'Conta criada com sucesso.'
            });
        });
    });
});

app.get('/getBillCard', (req, res) => {
    const { PisoCompartido_idPisoCompartido } = req.query; // Obtém o PisoCompartido_idPisoCompartido da query string
    if (!PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'PisoCompartido_idPisoCompartido é obrigatório.' });
    }
    const query = 'SELECT valor, diaVencimiento, compra FROM RegistroCuentas WHERE PisoCompartido_idPisoCompartido = ?';
    connection.query(query, [PisoCompartido_idPisoCompartido], (err, results) => {
        if (err) {
            console.error('Erro ao obter faturas:', err);
            return res.status(500).json({ success: false, message: 'Erro ao obter faturas.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhuma fatura encontrada para o Piso Compartido.' });
        }
        const bills = results.map(item => ({
            bill_info: item.bill_info
        }));
        res.status(200).json(bills);
    });
});

app.delete('/deleteBillCard', (req, res) => {
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
app.get('/getCleaningCard', (req, res) => {
    const { PisoCompartido_idPisoCompartido } = req.query; // Obtém o PisoCompartido_idPisoCompartido da query string

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

        // Retorna os quehaceres e diaVencimiento diretamente
        const calendario = results.map(item => ({
            quehacer: item.quehacer,
            diaVencimiento: item.diaVencimiento
        }));

        // Retorna o array de quehaceres diretamente
        res.status(200).json(calendario);
    });
});


// Rota para criar um novo "calendario"
app.post('/createCleaningCard', (req, res) => {
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

// Rota para deletar um evento de calendário com base no quehacer e PisoCompartido_idPisoCompartido
app.delete('/deleteCleaningCard', (req, res) => {
    const { quehacer, PisoCompartido_idPisoCompartido } = req.body;  // Espera os parâmetros no corpo da requisição

    // Verificar se o quehacer e PisoCompartido_idPisoCompartido foram fornecidos
    if (!quehacer || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ message: 'quehacer e PisoCompartido_idPisoCompartido são obrigatórios.' });
    }

    // Query para deletar o evento de calendário com base no quehacer e PisoCompartido_idPisoCompartido
    const query = 'DELETE FROM Calendario WHERE quehacer = ? AND PisoCompartido_idPisoCompartido = ?';

    connection.query(query, [quehacer, PisoCompartido_idPisoCompartido], (err, results) => {
        if (err) {
            console.error('Erro ao deletar evento de calendário:', err);
            return res.status(500).json({ message: 'Erro ao tentar deletar evento de calendário.' });
        }

        // Verificar se algum evento foi deletado
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: 'Evento de calendário não encontrado.' });
        }

        // Retornar sucesso
        res.status(200).json({
            success: true,
            message: 'Evento de calendário deletado com sucesso.'
        });
    });
});


app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
