const express = require('express');
const mysql = require('mysql2');
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
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
app.get('/get_membros', (req, res) => {
    const { PisoCompartido_idPisoCompartido } = req.query;

    if (!PisoCompartido_idPisoCompartido) {
        return res.status(400).json({
            success: false,
            message: 'O parâmetro PisoCompartido_idPisoCompartido é obrigatório.'
        });
    }
    const query = `
        SELECT nombre 
        FROM Usuarios 
        WHERE PisoCompartido_idPisoCompartido = ?
    `;
    connection.query(query, [PisoCompartido_idPisoCompartido], (err, results) => {
        if (err) {
            console.error('Erro ao buscar membros:', err);
            return res.status(500).json({
                success: false,
                message: 'Erro no servidor ao buscar membros.'
            });
        }
        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nenhum membro encontrado para o Piso Compartido informado.'
            });
        }
        const members = results.map(member => member.nome);
        res.status(200).json({
            success: true,
            members
        });
    });
});


app.post('/criar_usuario', (req, res) => {
    const { nombre, email, contraseña } = req.body;
    if (!nombre || !email || !contraseña) {
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }
    const PisoCompartido_idPisoCompartido = 1; 
    const Rol_idRol = 2; 
    connection.query('SELECT MAX(idUsuarios) AS maxId FROM Usuario', (err, results) => {
        if (err) {
            console.error('Erro ao buscar o último idUsuarios:', err);
            return res.status(500).json({ error: 'Erro ao buscar o último idUsuarios' });
        }
        const newId = results[0].maxId ? results[0].maxId + 1 : 1; 
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
                            codigo: codigoRepublica,  
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
    connection.query('SELECT MAX(idPisoCompartido) AS maxId FROM PisoCompartido', (err, results) => {
        if (err) {
            console.error('Erro ao buscar o maior idPisoCompartido:', err);
            return res.status(500).json({ success: false, message: 'Erro ao buscar o maior idPisoCompartido' });
        }
        const newIdRepublica = results[0].maxId + 1;
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
    const { PisoCompartido_idPisoCompartido } = req.query; 
    if (!PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'PisoCompartido_idPisoCompartido é obrigatório.' });
    }

    const queryBoletins = `
        SELECT informaciones, idMuro, Usuario_idUsuarios 
        FROM MuroAnuncios 
        WHERE PisoCompartido_idPisoCompartido = ?
    `;

    connection.query(queryBoletins, [PisoCompartido_idPisoCompartido], (err, boletinsResults) => {
        if (err) {
            console.error('Erro ao obter boletins:', err);
            return res.status(500).json({ success: false, message: 'Erro ao obter boletins.' });
        }

        if (boletinsResults.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum boletim encontrado para o Piso Compartido.' });
        }

        // Mapear os boletins e buscar os nomes dos usuários
        const boletins = [];
        const queries = boletinsResults.map(item => {
            return new Promise((resolve, reject) => {
                const queryUsuario = `SELECT nombre FROM Usuario WHERE idUsuarios = ?`;
                connection.query(queryUsuario, [item.Usuario_idUsuarios], (err, usuarioResults) => {
                    if (err) {
                        return reject(err);
                    }
                    if (usuarioResults.length > 0) {
                        boletins.push({
                            informaciones: item.informaciones,
                            idMuro: item.idMuro,
                            nombre: usuarioResults[0].nombre
                        });
                    }
                    resolve();
                });
            });
        });

        Promise.all(queries)
            .then(() => {
                res.status(200).json(boletins);
            })
            .catch(error => {
                console.error('Erro ao buscar usuários:', error);
                res.status(500).json({ success: false, message: 'Erro ao buscar informações dos usuários.' });
            });
    });
});



app.post('/createBulletinCard', (req, res) => {
    const { informaciones, Usuario_idUsuarios, PisoCompartido_idPisoCompartido } = req.body;
    if (!informaciones || !Usuario_idUsuarios || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'informaciones, Usuario_idUsuarios e PisoCompartido_idPisoCompartido são obrigatórios.' });
    }
    const countQuery = 'SELECT MAX(idMuro) AS maxId FROM MuroAnuncios';
    connection.query(countQuery, (err, results) => {
        if (err) {
            console.error('Erro ao buscar o maior idMuro:', err);
            return res.status(500).json({ success: false, message: 'Erro ao buscar o maior idMuro.' });
        }
        const nextIdMuro = results[0].maxId + 1;
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

app.delete('/deleteBulletinCard', (req, res) => {
    const { idMuro, PisoCompartido_idPisoCompartido } = req.query;
    if (!idMuro || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({
            success: false,
            message: 'Os campos informaciones e PisoCompartido_idPisoCompartido são obrigatórios.'
        });
    }
    const query = `
        DELETE FROM MuroAnuncios
        WHERE idMuro = ? AND PisoCompartido_idPisoCompartido = ?
    `;
    connection.query(query, [idMuro, PisoCompartido_idPisoCompartido], (err, results) => {
        if (err) {
            console.error('Erro ao deletar o anúncio:', err);
            return res.status(500).json({
                success: false,
                message: 'Erro no servidor ao tentar deletar o anúncio.'
            });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nenhum anúncio encontrado para os parâmetros fornecidos.'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Anúncio deletado com sucesso.'
        });
    });
});


app.post('/createBillCard', (req, res) => {
    const { valor, diaVencimiento, compra, PisoCompartido_idPisoCompartido } = req.body;
    if (!valor || !diaVencimiento || !compra || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }
    const countQuery = 'SELECT MAX(idCuenta) AS maxId FROM RegistroCuentas';
    connection.query(countQuery, (err, results) => {
        if (err) {
            console.error('Erro ao buscar o maior idCuenta:', err);
            return res.status(500).json({ success: false, message: 'Erro ao buscar o maior idCuenta.' });
        }
        const newIdCuenta = results[0].maxId + 1;
        const insertQuery = `
            INSERT INTO RegistroCuentas (idCuenta, valor, diaVencimiento, compra, PisoCompartido_idPisoCompartido)
            VALUES (?, ?, ?, ?, ?)
        `;
        connection.query(insertQuery, [newIdCuenta, valor, diaVencimiento, compra, PisoCompartido_idPisoCompartido], (err) => {
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
    const { PisoCompartido_idPisoCompartido } = req.query; 
    if (!PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'PisoCompartido_idPisoCompartido é obrigatório.' });
    }
    const query = `
        SELECT valor, diaVencimiento, compra, idCuenta
        FROM RegistroCuentas 
        WHERE PisoCompartido_idPisoCompartido = ?
    `;
    connection.query(query, [PisoCompartido_idPisoCompartido], (err, results) => {
        if (err) {
            console.error('Erro ao obter faturas:', err);
            return res.status(500).json({ success: false, message: 'Erro ao obter faturas.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhuma fatura encontrada para o Piso Compartido.' });
        }
        const bills = results.map(item => ({
            valor: item.valor,
            diaVencimiento: item.diaVencimiento.toISOString().split('T')[0], 
            compra: item.compra,
            idCuenta: idCuenta
        }));

        res.status(200).json(bills);
    });
});



app.delete('/deleteBillCard', (req, res) => {
    const { idCuenta, PisoCompartido_idPisoCompartido } = req.query;
    if (!idCuenta || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ message: 'Parâmetros incompletos. Informe compra e PisoCompartido_idPisoCompartido.' });
    }
    const query = `
        DELETE FROM RegistroCuentas 
        WHERE idCuenta = ? AND PisoCompartido_idPisoCompartido = ?
    `;
    connection.query(query, [idCuenta, PisoCompartido_idPisoCompartido], (err, results) => {
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

app.get('/getCleaningCard', (req, res) => {
    const { PisoCompartido_idPisoCompartido } = req.query;
    if (!PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'PisoCompartido_idPisoCompartido é obrigatório.' });
    }
    const query = `
        SELECT quehacer, diaVencimiento, idCalendario 
        FROM CalendarioQuehaceres 
        WHERE PisoCompartido_idPisoCompartido = ?
    `;
    connection.query(query, [PisoCompartido_idPisoCompartido], (err, results) => {
        if (err) {
            console.error('Erro ao obter registros:', err);
            return res.status(500).json({ success: false, message: 'Erro ao obter registros.' });
        }
        const formattedResults = results.map(item => ({
            quehacer: item.quehacer,
            diaVencimiento: item.diaVencimiento.toISOString().split('T')[0],
            idCalendario: idCalendario
        }));
        res.status(200).json(formattedResults);
    });
});


app.post('/createCleaningCard', (req, res) => {
    const { quehacer, diaVencimiento, Usuario_idUsuarios, PisoCompartido_idPisoCompartido } = req.body;
    if (!quehacer || !diaVencimiento || !Usuario_idUsuarios || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }
    connection.query('SELECT MAX(idCalendario) AS maxId FROM CalendarioQuehaceres', (err, results) => {
        if (err) {
            console.error('Erro ao buscar o maior idCalendario:', err);
            return res.status(500).json({ success: false, message: 'Erro ao buscar o maior idCalendario.' });
        }
        const IdCalendario = results[0].maxId + 1;
        const query = `
            INSERT INTO CalendarioQuehaceres (idCalendario, quehacer, diaVencimiento, Usuario_idUsuarios, PisoCompartido_idPisoCompartido)
            VALUES (?, ?, ?, ?, ?)
        `;
        connection.query(query, [IdCalendario, quehacer, diaVencimiento, Usuario_idUsuarios, PisoCompartido_idPisoCompartido], (err, result) => {
            if (err) {
                console.error('Erro ao inserir o novo calendário:', err);
                return res.status(500).json({ success: false, message: 'Erro ao criar o calendário.' });
            }
            res.status(201).json({
                success: true,
                message: 'Calendário criado com sucesso'
            });
        });
    });
});

app.delete('/deleteCleaningCard', (req, res) => {
    const { idCalendario, PisoCompartido_idPisoCompartido } = req.query; 
    if (!idCalendario || !PisoCompartido_idPisoCompartido) {
        return res.status(400).json({ message: 'quehacer e PisoCompartido_idPisoCompartido são obrigatórios.' });
    }
    const query = 'DELETE FROM CalendarioQueHaceres WHERE idCalendario = ? AND PisoCompartido_idPisoCompartido = ?';
    connection.query(query, [idCalendario, PisoCompartido_idPisoCompartido], (err, results) => {
        if (err) {
            console.error('Erro ao deletar evento de calendário:', err);
            return res.status(500).json({ message: 'Erro ao tentar deletar evento de calendário.' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: 'Evento de calendário não encontrado.' });
        }
        res.status(200).json({
            success: true,
            message: 'Evento de calendário deletado com sucesso.'
        });
    });
});


app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
