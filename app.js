//DEPENDENCIES
const chalk      = require("chalk")
const dotenv     = require("dotenv")
const express    = require("express")
const hbs        = require("hbs")
const mongoose   = require("mongoose")
const bodyParser = require('body-parser')
const bcrypt     = require("bcrypt")
const session    = require("express-session")
const MongoStore = require("connect-mongo")(session)

//CONSTANTS
const app = express()

//MODELS
const Videogame = require('./models/Videogame.js')
const User = require('./models/User.js')

//CONFIGURATION

//Configuración de .env
require('dotenv').config()  

//Configuración de mongoose
mongoose.connect(`mongodb://localhost/${process.env.DATABASE}`, {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
})
.then((result) => {
  console.log(chalk.cyan(`Connected to Mongo! Database used: ${result.connections[0].name}`));
})
.catch((error) => {
  console.log(chalk.red(`There has been an error: ${error}`));
});

//Configuración de hbs
app.set('view engine', 'hbs')
app.set('views', __dirname + '/views')
hbs.registerPartials(__dirname + "/views/partials");

//Configuracion del body parser
app.use(bodyParser.urlencoded({ extended: true }));

//Configuracion carpeta estática
app.use(express.static(__dirname + '/public'))

//Configuracion de cookies
app.use(session({
  secret: "basic-auth-secret",
  // cookie: { maxAge: 60000 },
  saveUninitialized: true,
  resave: true,
  store: new MongoStore({
    mongooseConnection: mongoose.connection,
    ttl: 24 * 60 * 60 // 1 day
  })
}));

//ROUTES

//RUTA GET DE LA HOME PAGE
app.get('/', (req, res, next)=>{
  res.render('home', {session: req.session.currentUser})
})

app.get('/log-in', (req, res, next)=>{
  res.render('logIn')
})

app.post('/log-in', (req, res, next)=>{

  const {email, password} = req.body

  User.findOne({email: email})
  .then((result)=>{
    if(!result){
      res.render('logIn', {errorMessage: 'Este usuario no existe. Lo sentimos.'})
    } else {
      bcrypt.compare(password, result.password)
      .then((resultFromBcrypt)=>{
        if(resultFromBcrypt){
          req.session.currentUser = email
          console.log(req.session)
          res.redirect('/')
        } else {
          res.render('logIn', {errorMessage: 'Contraseña incorrecta. Por favor, vuelva a intentarlo.'})
        }
      })
    }
  })
})

app.get('/sign-up', (req, res, next)=>{
  res.render('signUp')
})

app.post('/sign-up', (req, res, next)=>{
  
  const {email, password} = req.body

  User.findOne({email: email})
    .then((result)=>{
      if(!result){
        bcrypt.genSalt(10)
        .then((salt)=>{
          bcrypt.hash(password, salt)
          .then((hashedPassword)=>{
      
            const hashedUser = {email: email, password: hashedPassword}
      
            User.create(hashedUser)
            .then((result)=>{
              res.redirect('/')
            })
      
          })
        })
        .catch((err)=>{
          res.send(err)
        })
      } else {
        res.render('logIn', {errorMessage: 'Este usuario ya existe. ¿Querías hacer Log In?'})
      }
    })
})

app.use((req, res, next) => {
  if (req.session.currentUser) { 
    next(); 
  } else {                          
    res.redirect('/log-in');         
  }                                 
})

//RUTA GET PARA RENDERIZAR EL FORMULARIO DE CREACIÓN DE UN NUEVO VIDEOJUEGO
app.get('/new-videogame', (req, res, next)=>{
  res.render('newVideogame')
})

//RUTA POST PARA CREAR UN NUEVO VIDEOJUEGO
app.post('/new-videogame', (req, res, next)=>{

  const splitString = (_string)=>{
    const genreString = _string
    const splittedGenreString = genreString.split(',')
    return splittedGenreString
  }

  const arrayPlatform = splitString(req.body.platform)
  const arrayGenre = splitString(req.body.genre)

  const newVideogame = {...req.body, genre: arrayGenre, platform: arrayPlatform}

  Videogame.create(newVideogame)
    .then((createdVideogame)=>{
      console.log(createdVideogame)
      User.updateOne({email: req.session.currentUser}, {$push: {videogames: createdVideogame._id}})
      .then((result)=>{
        console.log(result)
      })
      res.redirect('/all-videogames')
    })
    .catch((err)=>console.log(err))

})

//RUTA GET PARA VER LA PÁGINA PERSONALIZADA DE UN VIDEOJUEGO
app.get('/videogame/:id', (req, res, next)=>{

  const videogameID = req.params.id
    
  Videogame.findById(videogameID)
    .then((result)=>{
      res.render('singleVideogame', result)
    })
    .catch((err)=>{
      console.log(err)
      res.send(err)
    })    
  
})

//RUTA GET PARA VER TODOS MIS VIDEOJUEGOS
app.get('/all-videogames', (req, res, next)=>{
  // Videogame.find({}, {name: 1, imageUrl: 1, _id: 1}, {sort: {rating: -1}})
  //   .then((videogames)=>{
  //     res.render('allVideogames', {videogames})
  //   })
  //   .catch((err)=>{
  //     console.log(err)
  //     res.send(err)
  //   })    

  User.findOne({email: req.session.currentUser})
    .populate('videogames')
    .then((user)=>{
      const videogames = user.videogames
      res.render('allVideogames', {videogames})
    })
    .catch((err)=>{
      console.log(err)
      res.send(err)
    })   
})

//RUTA POST PARA ELIMINAR UN VIDEOJUEGO
app.post('/delete-game/:id', (req, res, next)=>{

  const id = req.params.id

  Videogame.findByIdAndDelete(id)
  .then(()=>{
    res.redirect('/all-videogames')
  })
  .catch((err)=>{
    console.log(err)
    res.send(err)
  })
})

//RUTA GET PARA VER EL FORMULARIO DE EDICIÓN DE UN VIDEOJUEGO
app.get('/edit-videogame/:id', (req, res, next)=>{

  const _id = req.params.id

  Videogame.findById(_id)
    .then((result)=>{
      res.render('editForm', result)
    })
    .catch((err)=>{
      console.log(err)
      res.send(err)
    })    
})

//RUTA POST PARA EDITAR UN VIDEOJUEGO
app.post('/edit-videogame/:id', (req, res, next)=>{

  const _id = req.params.id
  const editedVideogame = req.body

  Videogame.findByIdAndUpdate(_id, editedVideogame)
  .then(()=>{
    res.redirect(`/videogame/${_id}`)
  })
  .catch((err)=>{
    console.log(err)
    res.send(err)
  })
})

app.get('/log-out', (req, res, next)=>{
  req.session.destroy()
  res.redirect('/')
})



//LISTENER
app.listen(process.env.PORT, ()=>{
  console.log(chalk.blue.inverse.bold(`Conectado al puerto ${process.env.PORT}`))
})

