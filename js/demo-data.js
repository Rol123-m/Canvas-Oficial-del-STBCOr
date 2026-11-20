/* ============================================================
   DEMO-DATA.JS · Base de datos de estudiantes (72) + asignatura modelo
   Se usa en modo demo (localStorage). Al conectar Google Sheets,
   code.gs siembra esta misma base de datos con setup().
   ============================================================ */
window.DEMO = (() => {
  const E = (nombre, grupo, usuario, clave, estado = 'Activo') => ({ nombre, grupo, usuario, clave, estado });

  const estudiantes = [
    /* ---- 1.er año ---- */
    E('José A. Aguilera Preval', '1.er año', 'jose.aguilera', 'rk7bmsqr'),
    E('Jorge Amarales Sánchez', '1.er año', 'jorge.amarales', 'fb8vcrne'),
    E('Osmani Cabrera Leyva', '1.er año', 'osmani.cabrera', 'yur5vbgt'),
    E('Mario D. Comas Samuel', '1.er año', 'mario.comas', 'v2q9ckyp'),
    E('Carlos E. Correa Fernández', '1.er año', 'carlos.correa', 'n9ghdvzq'),
    E('Yoander Cutiño Martín', '1.er año', 'yoander.cutino', 'v523jymw'),
    E('Maikel Durán Tur', '1.er año', 'maikel.duran', '4ebenvak'),
    E('Raúl García Gómez', '1.er año', 'raul.garcia', '6pfnt8ua'),
    E('Armando Gómez Márquez', '1.er año', 'armando.gomez', 'j7uhwejs'),
    E('Duvier González Samuel', '1.er año', 'duvier.gonzalez', '4pefqzn6'),
    E('Gelkis Guerra Roldán', '1.er año', 'gelkis.guerra', 'hwxer5ne', 'Inactivo'),
    E('Adrián Guerra Sánchez', '1.er año', 'adrian.guerra', 'ntg5ch7a'),
    E('Sandy Guillen Cerpa', '1.er año', 'sandy.guillen', 'pz8a3b9s'),
    E('Josué Legra Pupo', '1.er año', 'josue.legra', '986k59bq'),
    E('Yacher R. Lores Aguilera', '1.er año', 'yacher.lores', 'j47wan55'),
    E('Frank Mena Santana', '1.er año', 'frank.mena', 'qf3ytus6'),
    E('Lesnier Ortiz Díaz', '1.er año', 'lesnier.ortiz', 'm7yjfwy3'),
    E('Usiel Navarro Rodríguez', '1.er año', 'usiel.navarro', 'y7p5bhpg'),
    E('Luis M.Rodriguez Hernández', '1.er año', 'luis.rodriguez', 'm7mz3akr'),
    E('Geovanis Samón Peña', '1.er año', 'geovanis.samon', 'krzs6cyg'),
    E('Alexei Savón Gutiérrez', '1.er año', 'alexei.savon', 'be6gjgvd'),
    /* ---- 2.º año ---- */
    E('Orlando Aguilar Fonseca', '2.º año', 'orlando.aguilar', 'umbq36rn'),
    E('Dennis Almaguer George', '2.º año', 'dennis.almaguer', 'kwphb28m'),
    E('Leonard Luis Carrera Castillo', '2.º año', 'leonard.carrera', 'k8uv448w'),
    E('Amauri Escudero Guilarte', '2.º año', 'amauri.escudero', 'bns73pe8'),
    E('Hector Fernández Valdéz', '2.º año', 'hector.fernandez', 'snehwc9v'),
    E('Marcos González González', '2.º año', 'marcos.gonzalez', 'tgbaw85r'),
    E('Yulin Labrada Hernández', '2.º año', 'yulin.labrada', 'tfkxxmdg'),
    E('Alexei López Lamorú', '2.º año', 'alexei.lopez', 'c86y3v92'),
    E('Yoanys Luvín Delis', '2.º año', 'yoanys.luvin', 'g5w9uu58'),
    E('Joel Favio Martínez Oconor', '2.º año', 'joel.martinez', 'frjc4jvt'),
    E('Yolexis Merencio Árias', '2.º año', 'yolexis.merencio', 'yx4c26df'),
    E('Maikel Molina Figueredo', '2.º año', 'maikel.molina', 'm28cnapw'),
    E('Midel Pileta Romero', '2.º año', 'midel.pileta', 'ewrgh9q8'),
    E('Willer Luis Rabilero Martínez', '2.º año', 'willer.rabilero', 'd8jj8vtd'),
    E('Orley Rodríguez Navarro', '2.º año', 'orley.rodriguez', 's7mbphxt'),
    E('Jolkis Samiñon Paumier', '2.º año', 'jolkis.saminon', 'huxma7b7'),
    E('Victor Torno Mulet', '2.º año', 'victor.torno', 'z8aqdypk'),
    /* ---- 3.er año ---- */
    E('Rolando Aguilar Merayo', '3.er año', 'rolando.aguilar', 'ctfx7hqe'),
    E('Gerardo Almenares Cardoza', '3.er año', 'gerardo.almenares', 'cvk8yddz'),
    E('Ronny Babastro Pérez', '3.er año', 'ronny.babastro', 'qx7qgvg5'),
    E('Aldo Benitez Suarez', '3.er año', 'aldo.benitez', 'stjj9z4s'),
    E('Roleydis Cantillo Furones', '3.er año', 'roleydis.cantillo', 'extvwm6s'),
    E('Eudis Daniel Cardozo Heredia', '3.er año', 'eudis.cardozo', '4b6rya8w'),
    E('Wilber Carrera Llorente', '3.er año', 'wilber.carrera', 'hwg3tja8'),
    E('Jeremías M. Cifuentes Latres', '3.er año', 'jeremias.cifuentes', 'gfzw92s7'),
    E('Armando Cutiño Viamontes', '3.er año', 'armando.cutino', 'bnpme3r8'),
    E('José Antonio Estrada Castro', '3.er año', 'jose.estrada', 'rd9cc3nc'),
    E('Luis Floiran Romero', '3.er año', 'luis.floiran', 'ev8tte25'),
    E('Alejandro Antonio Foubelo Ferrer', '3.er año', 'alejandro.foubelo', '8kj5r4ab'),
    E('Angel Gabriel García Cardero', '3.er año', 'angel.garcia', '7mvdhxek'),
    E('Ruliseidis Legrá Tamayo', '3.er año', 'ruliseidis.legra', 'h6q4qkfn'),
    E('Agustin Nicot Llorente', '3.er año', 'agustin.nicot', '8mq2qd2s'),
    E('Ilber Peña Gutiérrez', '3.er año', 'ilber.pena', 'zwfcfwsq'),
    E('Reidel Verdecia Pino', '3.er año', 'reidel.verdecia', 'akax9vw3'),
    E('David Walter Fis', '3.er año', 'david.walter', '4dzbdnjg'),
    /* ---- 4.º año ---- */
    E('Dannier Aldana Rivero', '4.º año', 'dannier.aldana', 'p7mbts22'),
    E('Diosmel Domínguez Matos', '4.º año', 'diosmel.dominguez', '3mrqwdwg'),
    E('Diosdelkis Hernández Cantillo', '4.º año', 'diosdelkis.hernandez', 'nbxfjqx2'),
    E('Mariano Hernández Nápoles', '4.º año', 'mariano.hernandez', 'hey3k7ja'),
    E('José Hernández Velázquez', '4.º año', 'jose.hernandez', 'uqsrhfhv'),
    E('Elienriel Lobaina Cantillo', '4.º año', 'elienriel.lobaina', 'k95achr9'),
    E('Jaikel López Nieto', '4.º año', 'jaikel.lopez', 'eye2d2wj'),
    E('Leonardo Vaillant García', '4.º año', 'leonardo.vaillant', 'm2c8mgn9'),
    /* ---- Sede Habana ---- */
    E('Magdiel Garcías Avíles', 'Sede Habana · 2.º año', 'magdiel.garcias', 'jmx7djb9'),
    E('José Antonio Leyva Rigñak', 'Sede Habana · 2.º año', 'jose.leyva', '8p636pav'),
    E('Jaider Portales Días', 'Sede Habana · 2.º año', 'jaider.portales', 'wefz7pfb'),
    E('Liuvel Sánchez Campos', 'Sede Habana · 2.º año', 'liuvel.sanchez', 'qzggej26'),
    E('David Hernández Galano', 'Sede Habana · 3.er año', 'david.hernandez', 'yms6dxke'),
    E('Elder Pulgar Valdéz', 'Sede Habana · 3.er año', 'elder.pulgar', 'pw4f2u8b'),
    E('Juan Carlos Díaz Salazar', 'Sede Habana · 3.er año', 'juan.diaz', 'yhf9eq8s'),
    E('Yeider Peña Samón', 'Sede Habana · 3.er año', 'yeider.pena', 'amxc84ff')
  ];

  const grupos = ['1.er año', '2.º año', '3.er año', '4.º año', 'Sede Habana · 2.º año', 'Sede Habana · 3.er año'];

  /* ---- Asignaturas modelo + profesores ----
     Los profesores son cuentas de la base de datos (usuario y contraseña).
     La dirección los crea desde la app y les envía sus credenciales. */
  function db() {
    const now = new Date().toISOString();
    const asig = 'asig-demo';
    return {
      estudiantes, grupos,
      profesores: [
        { id: 'pr1', nombre: 'Prof. Eliú Alarcón', usuario: 'eliud.griego', clave: 'griego2026', email: '', estado: 'Activo', creado: now },
        { id: 'pr2', nombre: 'Prof. Sara Mendoza', usuario: 'sara.mendoza', clave: 'homiletica7', email: '', estado: 'Activo', creado: now }
      ],
      asignaturas: [
        { id: asig, nombre: 'Griego Koiné I', descripcion: 'Introducción al griego del Nuevo Testamento. 12 lecciones para leer la Escritura en su lengua original.', color: '#14385c', profesor: 'eliud.griego', profesorNombre: 'Prof. Eliú Alarcón', chatAbierto: 'Si', creada: now },
        { id: 'asig-demo2', nombre: 'Homilética I', descripcion: 'Principios de la predicación expositiva y construcción del sermón.', color: '#3f7d58', profesor: '', profesorNombre: '', chatAbierto: 'No', creada: now }
      ],
      matriculas: [
        ...estudiantes.filter(e => e.grupo === '1.er año').map(e => ({ id: 'm-' + e.usuario, asignaturaId: asig, usuario: e.usuario, grupo: e.grupo, fecha: now })),
        ...estudiantes.filter(e => e.grupo === '3.er año').map(e => ({ id: 'm2-' + e.usuario, asignaturaId: 'asig-demo2', usuario: e.usuario, grupo: e.grupo, fecha: now }))
      ],
      pestanas: [
        { id: 'p1', asignaturaId: asig, titulo: 'Presentación', icono: 'fa-circle-info', tipo: 'contenido', orden: 1, visible: true,
          contenido: 'Bienvenido a la asignatura.\n\nEsta plataforma reúne todo lo que necesitas: los módulos de estudio, el vocabulario, los recursos y las evaluaciones.\n\n## Cómo funciona\n- Cada semana se abren nuevos módulos en el menú.\n- Marca cada módulo como completado al terminarlo.\n- Los quizzes se realizan aquí mismo y la nota se registra sola.\n\nSi tienes dudas, escribe a tu profesor.' },
        { id: 'p2', asignaturaId: asig, titulo: 'El alfabeto griego', icono: 'fa-font', tipo: 'contenido', orden: 2, visible: true,
          contenido: 'El alfabeto griego tiene 24 letras y es la base de todo el curso.\n\n## Vocales\nα ε η ι ο υ ω\n\n## Dígrafos y diptongos\n- αἰ εἰ οἰ υἰ αὐ εὐ ηυ\n- γγ γκ γχ ντ μπ\n\n## Observa\n- σ va en medio de palabra; ς al final.\n- La misma letra puede tener distinta pronunciación según la época.' },
        { id: 'p3', asignaturaId: asig, titulo: 'Vocabulario · Semana 1', icono: 'fa-book-open', tipo: 'vocabulario', orden: 3, visible: true,
          contenido: JSON.stringify({ filas: [['ἄνθρωπος', 'ser humano, hombre', 'nom. -ος'], ['θεός', 'Dios', 'nom. -ος'], ['λόγος', 'palabra, discurso', 'nom. -ος'], ['Ἰησοῦς', 'Jesús', 'nom. -ῦς'], ['Χριστός', 'Cristo, Ungido', 'nom. -ός'], ['πίστις', 'fe', 'nom. -ις'], ['χάρις', 'gracia', 'nom. -ις'], ['εἰρήνη', 'paz', 'nom. -η'], ['ἀγάπη', 'amor', 'nom. -η'], ['νόμος', 'ley', 'nom. -ος'], ['γραφή', 'Escritura', 'nom. -ή'], ['ἁμαρτία', 'pecado', 'nom. -ία']] }) },
        { id: 'p4', asignaturaId: asig, titulo: 'Recursos', icono: 'fa-folder-open', tipo: 'recursos', orden: 4, visible: true,
          contenido: JSON.stringify({ items: [{ t: 'Alfabeto griego', d: 'Tabla completa con letras, pronunciación y ejemplos.', u: '', b: 'Abrir PDF' }, { t: 'Tablas de declinación', d: 'Declinaciones completas de sustantivos y adjetivos.', u: '', b: 'Abrir PDF' }, { t: 'Vocabulario esencial', d: 'Las palabras más frecuentes del Nuevo Testamento.', u: '', b: 'Abrir recurso' }] }) }
      ],
      examenes: [
        { id: 'x1', asignaturaId: asig, titulo: 'Quiz 1 · El alfabeto', descripcion: 'Comprueba lo aprendido sobre el alfabeto griego.', visible: true, creado: now },
        { id: 'x2', asignaturaId: asig, titulo: 'Quiz 2 · Vocabulario básico', descripcion: 'Práctica de selección múltiple sobre el vocabulario de la semana 1.', visible: true, creado: now }
      ],
      preguntas: [
        { id: 'q1', examenId: 'x1', tipo: 'sm', texto: '¿Cómo se llama la primera letra del alfabeto griego?', opciones: JSON.stringify(['Beta', 'Alfa', 'Gamma', 'Delta']), correcta: 1, puntos: 2, orden: 1 },
        { id: 'q2', examenId: 'x1', tipo: 'sm', texto: '¿Cuántas letras tiene el alfabeto griego?', opciones: JSON.stringify(['22', '26', '24', '20']), correcta: 2, puntos: 2, orden: 2 },
        { id: 'q3', examenId: 'x1', tipo: 'sm', texto: '¿Qué letra es Ω?', opciones: JSON.stringify(['ómicron', 'omega', 'delta', 'lambda']), correcta: 1, puntos: 2, orden: 3 },
        { id: 'q4', examenId: 'x1', tipo: 'sm', texto: '¿Cuál de estas letras es una vocal?', opciones: JSON.stringify(['β', 'γ', 'η', 'π']), correcta: 2, puntos: 2, orden: 4 },
        { id: 'q5', examenId: 'x1', tipo: 'sm', texto: '¿Cómo se escribe «logos» (palabra) en griego?', opciones: JSON.stringify(['λόγος', 'θεός', 'ἄνθρωπος', 'πίστις']), correcta: 0, puntos: 2, orden: 5 },
        { id: 'q6', examenId: 'x2', tipo: 'sm', texto: '¿Qué significa λόγος?', opciones: JSON.stringify(['palabra, discurso', 'paz', 'ley', 'fe']), correcta: 0, puntos: 2, orden: 1 },
        { id: 'q7', examenId: 'x2', tipo: 'sm', texto: '¿Qué significa ἀγάπη?', opciones: JSON.stringify(['fe', 'amor', 'gracia', 'ley']), correcta: 1, puntos: 2, orden: 2 },
        { id: 'q8', examenId: 'x2', tipo: 'sm', texto: '¿Qué significa εἰρήνη?', opciones: JSON.stringify(['gracia', 'ley', 'paz', 'amor']), correcta: 2, puntos: 2, orden: 3 },
        { id: 'q9', examenId: 'x2', tipo: 'sm', texto: '¿Cómo se dice «Dios» en griego?', opciones: JSON.stringify(['κύριος', 'θεός', 'ἄνθρωπος', 'πίστις']), correcta: 1, puntos: 2, orden: 4 },
        { id: 'q10', examenId: 'x2', tipo: 'vf', texto: 'El alfabeto griego tiene 24 letras.', opciones: JSON.stringify(['Verdadero', 'Falso']), correcta: 0, puntos: 2, orden: 5 }
      ],
      anuncios: [
        { id: 'a1', asignaturaId: asig, titulo: 'Bienvenidos a Griego Koiné I', cuerpo: 'El curso es 100 % en línea. Cada semana se abren módulos nuevos y al cierre se realiza el quiz. Revisa la pestaña Recursos para el material complementario.', tag: 'Bienvenida', autor: 'Prof. Eliú Alarcón', fecha: now, pin: true },
        { id: 'a2', asignaturaId: 'asig-demo2', titulo: 'Homilética I · inicio de curso', cuerpo: 'Esta asignatura se está preparando. Pronto recibirás el plan de lecciones.', tag: 'Aviso', autor: 'Dirección', fecha: now, pin: false }
      ],
      chat: [
        { id: 'c1', asignaturaId: asig, usuario: 'eliud.griego', nombre: 'Prof. Eliú Alarcón', rol: 'profesor', texto: '¡Bienvenidos al foro de dudas! Aquí pueden preguntar sobre el alfabeto y la lección 1.', fecha: now }
      ],
      intentos: [],
      progreso: []
    };
  }

  return { estudiantes, grupos, db };
})();
