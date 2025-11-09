// Calls OpenAI, instructing it to ONLY return JSON like {"sentiment":"positive","analysis":"..."}
import { Handlers } from 'motia'
import { OpenAI } from 'openai'
import { z } from 'zod'


// 1) Create an OpenAI client (newer syntax)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
 
export const config = {
  type: 'event',
  name: 'openAiSentimentAnalyzer',
  description: 'Calls OpenAI to analyze sentiment and emits corresponding events.',
  subscribes: ['openai.analyzeSentimentRequest'],
  // We'll emit different events: "openai.positiveSentiment" or "openai.negativeSentiment"
  emits: ['openai.positiveSentiment', 'openai.negativeSentiment'],
  input: z.object({ text: z.string() }),
  flows: ['sentiment-app'],
} as const

export const handler: Handlers['openAiSentimentAnalyzer'] = async (input, { emit, logger }) => {
    const { text } = input

    logger.info('[OpenAiSentimentAnalyzer] Analyzing sentiment for text.', { text })

    try{
        const systemPrompt = 'You are an assistant that returns only JSON: {"sentiment":"positive|negative","analysis":"...","advice":"..."} based on the sentiment of the provided text.'
        const userPrompt = `Analyze the sentiment of this text: "${input.text}". Return JSON with keys "sentiment", "analysis", and "advice".`

        const repsponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
        })

        const content = repsponse.choices[0].message?.content || ''
        logger.info('[OpenAiSentimentAnalyzer] OpenAI response received.', { content })

        // Try to parse the response as JSON
        let parsed
        try {
            parsed = JSON.parse(content.trim())
        } catch (parseError) {
            logger.error('[OpenAiSentimentAnalyzer] Failed to parse OpenAI response as JSON.', { content, parseError })
            throw new Error('Invalid JSON response from OpenAI')
        }

        if(parsed.sentiment){
            if(parsed.sentiment.toLowerCase() === 'positive'){
                emit({
                    topic: 'openai.positiveSentiment', 
                    data: { ...parsed, sentiment: parsed.sentiment }
                })
            } else {
                emit({
                    topic: 'openai.negativeSentiment', 
                    data: { ...parsed, sentiment: parsed.sentiment }
                    })
            } 
        } else {
            logger.error('[OpenAiSentimentAnalyzer] Unexpected sentiment value.', { sentiment: parsed.sentiment })
        }

    }catch(error){
        logger.error('[OpenAiSentimentAnalyzer] Error during sentiment analysis.', { error })
        throw error
    }
}


 