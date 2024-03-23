require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, SelectMenuBuilder, EmbedBuilder, Events } = require('discord.js');
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
  // Add more game descriptions here
};

client.on(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'Playing games and chatting!', type: 3 }],
  });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith('!chat')) {
    const userInput = message.content.replace('!chat ', '');
    const response = await processUserInput(userInput);
    message.reply(response);
  }

  if (message.content.startsWith('!ask')) {
    const question = message.content.replace('!ask ', '');
    const answer = await answerQuestion(question);
    message.reply(`Q: ${question}\nA: ${answer}`);
  }

  if (message.content === '!games') {
    const gamesMenu = createGamesMenu();
    message.reply({ content: 'Select a game to play!', components: [gamesMenu] });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isSelectMenu()) return;

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
      // Add more game cases here
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
  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: `Q: ${question}\nA:` }],
    max_tokens: 150,
    temperature: 0.8,
  });
  return response.data.choices[0].message.content.trim();
}

function createGamesMenu() {
  return new ActionRowBuilder().addComponents(
    new SelectMenuBuilder()
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
        new SelectMenuBuilder()
          .setCustomId('trivia_answer')
          .setPlaceholder('Select your answer')
          .addOptions(
            currentQuestion.options.map((option, index) => ({
              label: option,
              value: option,
            }))
          )
      );
  
      await interaction.channel.send({ embeds: [questionEmbed], components: [row] });
  
      const filter = (i) => i.customId === 'trivia_answer' && i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });
  
      collector.on('collect', async (i) => {
        const selectedAnswer = i.values[0];
        if (selectedAnswer === currentQuestion.answer) {
          score++;
          await i.reply({ content: 'Correct answer!', ephemeral: true });
        } else {
          await i.reply({ content: `Wrong answer! The correct answer is ${currentQuestion.answer}.`, ephemeral: true });
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
  }
  
  async function generateTriviaQuestions(numberOfQuestions) {
    const prompt = `Generate ${numberOfQuestions} trivia questions with 4 answer options each. Provide the questions, options, and the correct answer in the following JSON format:
    [
      {
        "question": "Question 1 text",
        "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
        "answer": "Correct answer"
      },
      ...
    ]`;
  
    try {
      const response = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      });
  
      const generatedText = response.data.choices[0].message.content.trim();
      const triviaQuestions = JSON.parse(generatedText);
      return triviaQuestions;
    } catch (error) {
      console.error('Error generating trivia questions:', error);
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