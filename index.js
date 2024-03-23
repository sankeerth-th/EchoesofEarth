require('dotenv').config();

const { Client, GatewayIntentBits, MessageActionRow, MessageSelectMenu } = require('discord.js');
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

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setPresence({
        status: 'online',
        activities: [{
            name: 'Chat with me using !chat',
            type: 'PLAYING',
        }],
    });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    console.log(`Received message: ${message.content}`); // Log the received message

    if (message.content === '!games') {
        const row = new MessageActionRow().addComponents(
            new MessageSelectMenu()
                .setCustomId('select-game')
                .setPlaceholder('Choose a game...')
                .addOptions([
                    // Game options
                    {
                        label: 'Trivia',
                        description: 'Test your knowledge!',
                        value: 'trivia',
                    },
                    // Additional game options
                ]),
        );

        console.log('Sending games menu'); // Log when sending the games menu
        await message.reply({ content: 'Select a game to play!', components: [row] });
    } else if (message.content.startsWith('!chat')) {
        const userInput = message.content.replace('!chat ', '');
        console.log(`Processing chat command with input: ${userInput}`); // Log the user input for chat
        const botResponse = await processUserInput(userInput);
        console.log(`Bot response: ${botResponse}`); // Log the bot's response
        await message.reply(botResponse);
    }

    // Other commands can be added here
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isSelectMenu()) return;

    if (interaction.customId === 'select-game') {
        const selectedGame = interaction.values[0];
        console.log(`Game selected: ${selectedGame}`); // Log the selected game
        await interaction.update({ content: `You selected ${selectedGame}`, components: [] });

        // Add logic here for handling different games
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
        console.error('Error: ', error);
        return 'Error processing your request.';
    }
}


client.login(process.env.DISCORD_BOT_TOKEN);