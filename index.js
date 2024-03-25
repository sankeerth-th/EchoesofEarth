require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, Events } = require('discord.js');
const OpenAI = require('openai');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const gameDescriptions = {
  trivia: 'Test your knowledge with a variety of trivia questions!',
  hangman: 'Guess the word before the hangman is complete!',
  tictactoe: 'Play the classic game of Tic-Tac-Toe against the bot!',
  medicalTrivia: 'Test your medical knowledge with questions from various subjects!',
  // Add more game descriptions here
};

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'Playing games and chatting!', type: 3 }],
  });

  // Register slash commands
  const guildId = process.env.GUILD_ID;
  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    await guild.commands.create({
      name: 'games',
      description: 'Select a game to play',
    });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isCommand() && interaction.commandName === 'games') {
    const gamesMenu = createGamesMenu();
    await interaction.reply({ content: 'Select a game to play!', components: [gamesMenu], ephemeral: true });
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select-game') {
      const selectedGame = interaction.values[0];
      switch (selectedGame) {
        case 'trivia':
          await startTriviaGame(interaction);
          break;
        case 'hangman':
          await startHangmanGame(interaction);
          break;
        case 'tictactoe':
          await startTicTacToeGame(interaction);
          break;
        case 'medicalTrivia':
          await startMedicalTriviaGame(interaction);
          break;
        // Add more game cases here
      }
    }
  }
});

async function processUserInput(userInput) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: userInput }],
      max_tokens: 150,
      temperature: 0.8,
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error communicating with OpenAI:', error);
    return 'Sorry, an error occurred while processing your request.';
  }
}

async function answerQuestion(question) {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: `Q: ${question}\nA:` }],
    max_tokens: 150,
    temperature: 0.8,
  });
  return response.data.choices[0].message.content.trim();
}

function createGamesMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select-game')
      .setPlaceholder('Choose a game...')
      .addOptions(
        Object.entries(gameDescriptions).map(([value, description]) => ({
          label: value.charAt(0).toUpperCase() + value.slice(1),
          description,
          value,
        }))
      )
  );
}

async function startTriviaGame(interaction) {
  await interaction.reply({ content: 'Starting Trivia Game!', ephemeral: true });

  const numberOfQuestions = 5; // Specify the number of trivia questions to generate

  try {
    const triviaQuestions = await generateTriviaQuestions(numberOfQuestions);

    let score = 0;
    let questionIndex = 0;

    const askQuestion = async () => {
      const currentQuestion = triviaQuestions[questionIndex];
      const questionEmbed = new EmbedBuilder()
        .setTitle(`Question ${questionIndex + 1}`)
        .setDescription(currentQuestion.question)
        .addFields(
          currentQuestion.options.map((option, index) => ({
            name: `${String.fromCharCode(65 + index)}:`,
            value: option,
            inline: true,
          }))
        );

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('trivia_answer')
          .setPlaceholder('Select your answer')
          .addOptions(
            currentQuestion.options.map((option, index) => ({
              label: option,
              value: String.fromCharCode(65 + index),
            }))
          )
      );

      await interaction.channel.send({ embeds: [questionEmbed], components: [row] });

      const filter = (i) => i.customId === 'trivia_answer' && i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

      collector.on('collect', async (i) => {
        const selectedAnswer = i.values[0];
        if (selectedAnswer === currentQuestion.correctAnswer) {
          score++;
          await i.reply({ content: 'Correct answer!', ephemeral: true });
        } else {
          await i.reply({ content: `Wrong answer! The correct answer is ${currentQuestion.correctAnswer}.`, ephemeral: true });
        }
        collector.stop();
        questionIndex++;
        if (questionIndex < triviaQuestions.length) {
          await askQuestion();
        } else {
          await interaction.channel.send(`Trivia game finished! Your score: ${score}/${triviaQuestions.length}`);
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          await interaction.channel.send('Time\'s up! No answer selected.');
          questionIndex++;
          if (questionIndex < triviaQuestions.length) {
            await askQuestion();
          } else {
            await interaction.channel.send(`Trivia game finished! Your score: ${score}/${triviaQuestions.length}`);
          }
        }
      });
    };

    await askQuestion();

  } catch (error) {
    console.error('Error starting trivia game:', error);
    await interaction.channel.send(`Sorry, an error occurred: ${error.message}. Please try again later.`);
  }
}

async function startMedicalTriviaGame(interaction) {
  await interaction.reply({ content: 'Starting Medical Trivia Game!', ephemeral: true });

  const subjects = [
    'Anatomy',
    'Physiology',
    'Biochemistry',
    'Pharmacology',
    'Pathology',
    'Microbiology',
    'Forensic Medicine',
    'Community Medicine',
  ];

  const topics = {
    Anatomy: ['Gross Anatomy', 'Histology', 'Embryology', 'Neuroanatomy', 'Musculoskeletal System'],
    Physiology: ['General Physiology', 'Systemic Physiology', 'Cardiovascular Physiology', 'Respiratory Physiology', 'Renal Physiology'],
    Biochemistry: ['Enzymes', 'Metabolism', 'Nutrition', 'Molecular Biology', 'Hormones and Signaling'],
    Pharmacology: ['General Pharmacology', 'Chemotherapy', 'Autonomic Nervous System', 'Cardiovascular Pharmacology', 'Psychopharmacology'],
    Pathology: ['General Pathology', 'Systemic Pathology', 'Hematology', 'Oncology', 'Immunopathology'],
    Microbiology: ['Bacteriology', 'Virology', 'Mycology', 'Parasitology', 'Immunology'],
    'Forensic Medicine': ['Forensic Pathology', 'Toxicology', 'Medical Jurisprudence', 'Forensic Psychiatry', 'Forensic Anthropology'],
    'Community Medicine': ['Epidemiology', 'Biostatistics', 'Nutrition and Health', 'Maternal and Child Health', 'Occupational Health'],
  };

  const subjectSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('subject_select')
    .setPlaceholder('Select a subject')
    .addOptions(subjects.map((subject) => ({
      label: subject,
      value: subject,
    })));

  const subjectRow = new ActionRowBuilder().addComponents(subjectSelectMenu);

  await interaction.followUp({ content: 'Select a subject:', components: [subjectRow] });

  const subjectFilter = (i) => i.customId === 'subject_select' && i.user.id === interaction.user.id;
  const subjectCollector = interaction.channel.createMessageComponentCollector({ filter: subjectFilter, time: 30000 });

  subjectCollector.on('collect', async (i) => {
    await i.deferUpdate();
    const selectedSubject = i.values[0];
    const selectedTopics = topics[selectedSubject];

    const topicSelectMenu = new StringSelectMenuBuilder()
      .setCustomId('topic_select')
      .setPlaceholder('Select a topic')
      .addOptions(selectedTopics.map((topic) => ({
        label: topic,
        value: topic,
      })));

    const topicRow = new ActionRowBuilder().addComponents(topicSelectMenu);

    await i.editReply({ content: 'Select a topic:', components: [topicRow] });

    const topicFilter = (j) => j.customId === 'topic_select' && j.user.id === interaction.user.id;
    const topicCollector = interaction.channel.createMessageComponentCollector({ filter: topicFilter, time: 30000 });

    topicCollector.on('collect', async (j) => {
      await j.deferUpdate();
      const selectedTopic = j.values[0];

      const numberOfQuestions = 10; // Specify the number of medical trivia questions to generate

      try {
        const medicalTriviaQuestions = await generateMedicalTriviaQuestions(numberOfQuestions, [selectedSubject], { [selectedSubject]: [selectedTopic] });



    let score = 0;
    let questionIndex = 0;

    const askQuestion = async () => {
      const currentQuestion = medicalTriviaQuestions[questionIndex];
      const questionEmbed = new EmbedBuilder()
        .setTitle(`Question ${questionIndex + 1}`)
        .setDescription(currentQuestion.question)
        .addFields(
          currentQuestion.options.map((option, index) => ({
            name: `${String.fromCharCode(65 + index)}:`,
            value: option,
            inline: true,
          }))
        );

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('trivia_answer')
          .setPlaceholder('Select your answer')
          .addOptions(
            currentQuestion.options.map((option, index) => ({
              label: option,
              value: String.fromCharCode(65 + index),
            }))
          )
      );

      await interaction.channel.send({ embeds: [questionEmbed], components: [row] });

      const filter = (i) => i.customId === 'trivia_answer' && i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

      collector.on('collect', async (i) => {
        const selectedAnswer = i.values[0];
        if (selectedAnswer === currentQuestion.correctAnswer) {
          score++;
          await i.reply({ content: 'Correct answer!', ephemeral: true });
        } else {
          await i.reply({ content: `Wrong answer! The correct answer is ${currentQuestion.correctAnswer}.`, ephemeral: true });
        }
        collector.stop();
        questionIndex++;
        if (questionIndex < medicalTriviaQuestions.length) {
          await askQuestion();
        } else {
          await interaction.channel.send(`Medical Trivia game finished! Your score: ${score}/${medicalTriviaQuestions.length}`);
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          await interaction.channel.send('Time\'s up! No answer selected.');
          questionIndex++;
          if (questionIndex < medicalTriviaQuestions.length) {
            await askQuestion();
          } else {
            await interaction.channel.send(`Medical Trivia game finished! Your score: ${score}/${medicalTriviaQuestions.length}`);
          }
        }
      });
    };

    await askQuestion();

  } catch (error) {
    console.error('Error starting medical trivia game:', error);
    await interaction.channel.send(`Sorry, an error occurred: ${error.message}. Please try again later.`);
  }
});
});
}

async function generateTriviaQuestions(numberOfQuestions) {
    const prompt = `Generate ${numberOfQuestions} trivia questions with 4 multiple choice answers each, and mark the correct answer. Format the output as JSON. Example:
    [
      {
        "question": "What is the capital of France?",
        "options": ["Paris", "Berlin", "London", "Madrid"],
        "correctAnswer": "A"
      },
      {
        "question": "What is 2 + 2?",
        "options": ["3", "4", "5", "6"],
        "correctAnswer": "B"
      }
    ]`;
  
    try {
        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
          temperature: 0.7,
        });
        console.log("OpenAI API Response:", response); // Log the full response
        console.log("OpenAI API Message Content:", response.choices[0].message); // Log the message content

        if (response.choices && response.choices[0]) {
            const generatedText = response.choices[0].message.content.trim();
            try {
              const triviaQuestions = JSON.parse(generatedText);
              return triviaQuestions;
            } catch (jsonParseError) {
              console.error('Error parsing JSON:', jsonParseError, 'Response content:', generatedText);
              throw new Error('Error parsing trivia questions JSON');
            }
          } else {
            throw new Error('Invalid response from OpenAI API');
          }
        } catch (error) {
          console.error('Error generating trivia questions:', error);
          throw error;
        }
      }
  async function generateMedicalTriviaQuestions(numberOfQuestions, subjects, topics) {
    const prompt = `Generate ${numberOfQuestions} high-complexity medical trivia questions suitable for USMLE or NEET exams, with 4 multiple-choice answers each, and mark the correct answer. Use the following subject and topic for generating the questions:

    Subject: ${subjects[0]}
    Topic: ${topics[subjects[0]][0]}
    
    Format the output as JSON. Example:
    [
      {
        "question": "What is the most common cause of acute pancreatitis?",
        "options": ["Alcohol", "Gallstones", "Trauma", "Medications"],
        "correctAnswer": "B"
      },
      {
        "question": "Which of the following is a characteristic feature of acute inflammation?",
        "options": ["Fibrosis", "Granuloma formation", "Vascular dilation", "Caseous necrosis"],
        "correctAnswer": "C"
      }
    ]`;
      
        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 3000,
            temperature: 0.7,
          });
          console.log("OpenAI API Response:", response); // Log the full response
          console.log("OpenAI API Message Content:", response.choices[0].message); // Log the message content
      
          if (response.choices && response.choices[0]) {
            const generatedText = response.choices[0].message.content.trim();
            try {
              const medicalTriviaQuestions = JSON.parse(generatedText);
              return medicalTriviaQuestions;
            } catch (jsonParseError) {
              console.error('Error parsing JSON:', jsonParseError, 'Response content:', generatedText);
              throw new Error('Error parsing medical trivia questions JSON');
            }
          } else {
            throw new Error('Invalid response from OpenAI API');
          }
        } catch (error) {
          console.error('Error generating medical trivia questions:', error);
          throw error;
        }
      }
  

async function startHangmanGame(interaction) {
  await interaction.reply({ content: 'Starting Hangman Game!', ephemeral: true });
  // Hangman game logic goes here
}

async function startTicTacToeGame(interaction) {
  await interaction.reply({ content: 'Starting Tic-Tac-Toe Game!', ephemeral: true });
  // Tic-Tac-Toe game logic goes here
}

client.login(process.env.DISCORD_BOT_TOKEN);