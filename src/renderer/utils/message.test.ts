import { Message } from 'src/shared/types'
import { sequenceMessages } from './message'

describe('SequenceMessages', () => {
  // Each test case
  const cases: {
    name: string
    input: Message[]
    expected: Message[]
  }[] = [
    {
      name: 'should sequence messages correctly',
      input: [
        { id: '', role: 'system', contentParts: [{ type: 'text', text: 'S1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U2' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
        { id: '', role: 'system', contentParts: [{ type: 'text', text: 'S2' }] },
      ],
      expected: [
        { id: '', role: 'system', contentParts: [{ type: 'text', text: 'S1\n\nS2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1\n\nA2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U2' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
    },
    {
      name: '助手先于用户发言',
      input: [
        { id: '', role: 'system', contentParts: [{ type: 'text', text: 'S1' }] },
        {
          id: '',
          role: 'assistant',
          contentParts: [
            {
              type: 'text',
              text: `L1
L2
L3

`,
            },
          ],
        },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
      expected: [
        { id: '', role: 'system', contentParts: [{ type: 'text', text: 'S1' }] },
        {
          id: '',
          role: 'user',
          contentParts: [
            {
              type: 'text',
              text: `> L1
> L2
> L3
> 

`,
            },
          ],
        },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
    },
    {
      name: '没有系统消息',
      input: [
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
      expected: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '> A1\n' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
    },
    {
      name: '没有系统消息 2',
      input: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U2' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
      ],
      expected: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U2' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
      ],
    },
    {
      name: '去除空消息',
      input: [
        { id: '', role: 'system', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
      expected: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '> A1\n' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
    },
    {
      name: '只有 user 消息',
      input: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U2' }] },
      ],
      expected: [{ id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1\n\nU2' }] }],
    },
    {
      name: '只有 assistant 消息',
      input: [
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
      ],
      expected: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '> A1\n' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
      ],
    },
    {
      name: '只有一条 assistant 消息，应该转化成 user 消息',
      input: [{ id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] }],
      expected: [{ id: '', role: 'user', contentParts: [{ type: 'text', text: '> A1\n' }] }],
    },
    {
      name: '只有一条不为空的 assistant 消息，应该转化成 user 消息',
      input: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
      ],
      expected: [{ id: '', role: 'user', contentParts: [{ type: 'text', text: '> A1\n' }] }],
    },
    {
      name: '只有一条 system 消息，应该转化成 user 消息',
      input: [{ id: '', role: 'system', contentParts: [{ type: 'text', text: 'S1' }] }],
      expected: [{ id: '', role: 'user', contentParts: [{ type: 'text', text: 'S1' }] }],
    },
    {
      name: '只有一条不为空的 system 消息，应该转化成 user 消息',
      input: [
        { id: '', role: 'system', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'system', contentParts: [{ type: 'text', text: 'S1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: '' }] },
      ],
      expected: [{ id: '', role: 'user', contentParts: [{ type: 'text', text: 'S1' }] }],
    },
    {
      name: '合并图片',
      input: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        {
          id: '',
          role: 'user',
          contentParts: [
            { type: 'text', text: 'U2' },
            { type: 'image', storageKey: 'url1' },
          ],
        },
        {
          id: '',
          role: 'user',
          contentParts: [
            { type: 'text', text: 'U3' },
            { type: 'image', storageKey: 'url2' },
          ],
        },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U4' }] },
      ],
      expected: [
        {
          id: '',
          role: 'user',
          contentParts: [
            { type: 'text', text: 'U1\n\nU2\n\nU3\n\nU4' },
            { type: 'image', storageKey: 'url1' },
            { type: 'image', storageKey: 'url2' },
          ],
        },
      ],
    },
  ]
  cases.forEach(({ name, input, expected }) => {
    test(name, () => {
      const got = sequenceMessages(input)

      expect(got.length).toBe(expected.length)

      got.forEach((gotMessage, index) => {
        const expectedMessage = expected[index]
        // If you have an isEqual method, you can use it here, or manually compare properties like this:
        expect(gotMessage).toEqual(expectedMessage)
      })
    })
  })
})
