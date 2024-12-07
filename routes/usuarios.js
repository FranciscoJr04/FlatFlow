const express = require('express');
const router = express.Router();
const db = require('../services/db');
const api = require('../services/api');

// Exemplo: Obter usuários do banco
router.get('/usuarios-local', (req, res) => {
    db.query('SELECT * FROM usuarios', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Erro ao buscar usuários.');
        }
        res.json(results);
    });
});

// Exemplo: Obter usuários da API
router.get('/usuarios-api', async (req, res) => {
    try {
        const response = await api.get('/usuarios/');
        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao buscar usuários da API.');
    }
});

module.exports = router;
